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
const node_util_1 = require("node:util");
const pdf_mjs_1 = require("pdfjs-dist/legacy/build/pdf.mjs");
const node_stream_1 = __importDefault(require("node:stream"));
require('dotenv').config();
require("mocha");
const chai = __importStar(require("chai"));
const chai_1 = require("chai");
chai.use(require('chai-fs'));
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
const checkForPdfBase64StringValidity = async (pdfAsBase64) => {
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
};
describe('Testing GED deposit', async () => {
    let pdfFullPath = process.env.PDFANNEXPATH;
    it('should get a ticket', async () => {
        const ticket = await (0, src_1.fetchTicket)(alfrescoInfo);
        (0, chai_1.expect)(ticket).to.not.be.empty;
    });
    it('should read the student folder', async () => {
        const ticket = await (0, src_1.fetchTicket)(alfrescoInfo);
        await (0, src_1.readFolder)(alfrescoInfo, studentInfo, ticket);
    });
    it('should upload a pdf file to the student folder. The pdf become a base 64, then a form data.', async () => {
        // don't do this test if it looks like we are in a non-test server
        if (!process.env.ALFRESCO_URL.includes('test'))
            throw new Error(`Failing test because the server may be the production`);
        // read the pdf file to base64
        const pdfFile = fs.readFileSync(__dirname + '/sample.pdf');
        const base64String = pdfFile.toString('base64');
        const pdfFileName = `Rapport annuel doctorat-allo2.pdf`;
        const pdfFileBuffer = Buffer.from(base64String, 'base64');
        const ticket = await (0, src_1.fetchTicket)(alfrescoInfo);
        pdfFullPath = await (0, src_1.uploadPDF)(alfrescoInfo, studentInfo, ticket, pdfFileName, pdfFileBuffer);
        // Try to read back the file
        const pdfAsBase64 = await (0, src_1.fetchFileAsBase64)(pdfFullPath, ticket);
        await checkForPdfBase64StringValidity(pdfAsBase64);
    }).timeout(10000); // 2000, the default, is not enough for this operation
    it('should fetch a pdf as a base64 string', async () => {
        const ticket = await (0, src_1.fetchTicket)(alfrescoInfo);
        (0, chai_1.expect)(pdfFullPath, 'Please set up the env var PDFANNEXPATH correctly').to.not.be.empty;
        const pdfAsBase64 = await (0, src_1.fetchFileAsBase64)(pdfFullPath, ticket);
        (0, chai_1.expect)(pdfAsBase64).to.not.be.empty;
        // can we decode this with base64 ?
        (0, chai_1.expect)(() => btoa(atob(pdfAsBase64))).to.not.throw();
        await checkForPdfBase64StringValidity(pdfAsBase64);
    });
    it('should stream a pdf to a file', async () => {
        (0, chai_1.expect)(pdfFullPath, 'Please set up the env var PDFANNEXPATH correctly').to.not.be.empty;
        const ticket = await (0, src_1.fetchTicket)(alfrescoInfo);
        const destinationPath = path.join('/tmp', pdfFullPath.split('/').pop());
        if (fs.existsSync(destinationPath))
            fs.unlinkSync(destinationPath);
        (0, chai_1.expect)(destinationPath).to.not.be.a.path();
        // set a timeout
        const controller = new globalThis.AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 40000);
        // Set the stream to the remote file
        const alfrescoStream = await (0, src_1.getFileStream)(pdfFullPath, ticket, controller);
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
        const pdf = (0, pdf_mjs_1.getDocument)(destinationPath);
        const doc = await pdf.promise;
        (0, chai_1.expect)(doc).to.not.be.empty;
        (0, chai_1.expect)(doc.numPages).to.be.greaterThan(0);
    });
});
