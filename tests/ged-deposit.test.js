"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Here you can manually test the GED deposit.
 * Please set the .env correctly, you don't want to use production
 */
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const fsp = __importStar(require("node:fs/promises"));
const node_util_1 = require("node:util");
const pdf_mjs_1 = require("pdfjs-dist/legacy/build/pdf.mjs");
const node_stream_1 = __importDefault(require("node:stream"));
const node_abort_controller_1 = require("node-abort-controller");
const filenames_1 = require("./lib/filenames");
require('dotenv').config();
require("mocha");
const chai = __importStar(require("chai"));
const chai_1 = require("chai");
chai.use(require('chai-fs'));
chai.use(require('chai-bytes'));
const src_1 = require("../src");
const studentInfo = {
    doctoralAcronym: process.env.PHDSTUDENTDOCTORATACRONYM,
    studentName: process.env.PHDSTUDENTNAME,
    sciper: process.env.PHDSTUDENTSCIPER,
};
const alfrescoInfo = {
    serverUrl: process.env.ALFRESCO_URL,
    username: process.env.ALFRESCO_USERNAME,
    password: process.env.ALFRESCO_PASSWORD,
};
// Exclude some test if it looks like we are in a non-test server
const abortWritingTestIfProd = () => {
    if (!process.env.ALFRESCO_URL.includes('test')) {
        throw new Error(`Failing test because the server may be the production`);
    }
};
async function getPdfSampleBytes(fromPath = __dirname + '/sample.pdf') {
    return await fsp.readFile(fromPath);
}
let ticket = '';
let pdfUploadedPath = ''; // will receive the uploaded PDF path
let pdfFile;
let pdfFileName;
describe('Testing GED deposit and readability', async () => {
    before(async () => {
        abortWritingTestIfProd();
        ticket = await (0, src_1.fetchTicket)(alfrescoInfo);
        // the PDF sample used to do the upload
        pdfFile = await getPdfSampleBytes(__dirname + '/sample.pdf');
        pdfFileName = `Rapport-${(0, filenames_1.makeid)()}.pdf`;
    });
    beforeEach(async () => {
        // set an upload if we don't already, allowing to run test independently
        if (!pdfUploadedPath) {
            pdfUploadedPath = await (0, src_1.uploadPDF)(alfrescoInfo, studentInfo, ticket, pdfFileName, pdfFile);
        }
    });
    it('should have the ticket', async () => {
        (0, chai_1.expect)(ticket).to.not.be.empty;
    });
    it('should read the student folder', async () => {
        await (0, src_1.readFolder)(alfrescoInfo, studentInfo, ticket);
    });
    it('should upload a pdf file to the student folder', async () => {
        (0, chai_1.expect)(pdfUploadedPath).to.not.be.empty;
    });
    it('should download and check that is the same file', async () => {
        const pdfAsBase64 = await (0, src_1.fetchFileAsBase64)(pdfUploadedPath, ticket);
        (0, chai_1.expect)(Buffer.from(pdfAsBase64, "base64")
        // @ts-ignore
        ).to.equalBytes(pdfFile);
    });
    it('should fetch the pdf as a base64 string and be openable as PDF', async () => {
        const pdfAsBase64 = await (0, src_1.fetchFileAsBase64)(pdfUploadedPath, ticket);
        (0, chai_1.expect)(pdfAsBase64).to.not.be.empty;
        // can we decode this with base64 ?
        (0, chai_1.expect)(() => btoa(atob(pdfAsBase64))).to.not.throw();
        // can we open this as pdf ?
        const buffer = Buffer.from(pdfAsBase64, 'base64');
        const pdfGeneratedUint8 = new Uint8Array(buffer);
        const pdf = (0, pdf_mjs_1.getDocument)({ data: pdfGeneratedUint8 });
        const doc = await pdf.promise;
        (0, chai_1.expect)(doc).to.not.be.empty;
        (0, chai_1.expect)(doc.numPages).to.be.greaterThan(0);
    });
    it('should stream a pdf to a file', async () => {
        const destinationPath = path.join('/tmp', pdfFileName);
        if (fs.existsSync(destinationPath))
            fs.unlinkSync(destinationPath);
        (0, chai_1.expect)(destinationPath).to.not.be.a.path();
        // set a timeout
        const controller = new node_abort_controller_1.AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 40000);
        // Set the stream to the remote file
        const alfrescoStream = await (0, src_1.getFileStream)(pdfUploadedPath, ticket, controller);
        try {
            // Set the stream to the filesystem
            const fileStream = fs.createWriteStream(destinationPath);
            // Pipe them
            // from https://github.com/sindresorhus/got/blob/v12.6.1/documentation/3-streams.md
            const pipeline = (0, node_util_1.promisify)(node_stream_1.default.pipeline);
            await pipeline(alfrescoStream.body, fileStream);
        }
        catch (error) {
            throw error;
        }
        finally {
            clearTimeout(timeout);
        }
        (0, chai_1.expect)(destinationPath).to.be.a.path();
        console.log(`Successfully written the file ${destinationPath}`);
        const pdf = (0, pdf_mjs_1.getDocument)(destinationPath);
        const doc = await pdf.promise;
        (0, chai_1.expect)(doc).to.not.be.empty;
        (0, chai_1.expect)(doc.numPages).to.be.greaterThan(0);
    });
    it('should check if a file name already exists in the folder', async () => {
        const folderCmisObjects = await (0, src_1.readFolder)(alfrescoInfo, studentInfo, ticket);
        (0, chai_1.expect)((0, src_1.fileNameExists)(pdfUploadedPath.split('/').pop(), folderCmisObjects)).to.be.true;
        (0, chai_1.expect)((0, src_1.fileNameExists)(
        // should be a free name
        pdfUploadedPath.split('/').pop() + (0, filenames_1.makeid)(), folderCmisObjects)).to.be.false;
    });
    // This behavior is so surprising that I have a test to demonstrate it
    it('should do a name switch when the file uploaded has a name already set', async () => {
        // Post a file with same name
        const pdfUploadedPath2 = await (0, src_1.uploadPDF)(alfrescoInfo, studentInfo, ticket, pdfUploadedPath.split('/').pop(), pdfFile);
        (0, chai_1.expect)(pdfUploadedPath2.split('/').pop()).to.not.equal(pdfUploadedPath.split('/').pop());
    });
}).timeout(5000); // raise the default, operation are network dependent
