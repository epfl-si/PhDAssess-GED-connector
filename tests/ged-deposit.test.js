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
const node_stream_1 = __importDefault(require("node:stream"));
require('dotenv').config();
require("mocha");
const chai = __importStar(require("chai"));
const chai_1 = require("chai");
chai.use(require('chai-fs'));
const src_1 = require("../src");
const phdStudentName = process.env.PHDSTUDENTNAME;
const phdStudentSciper = process.env.PHDSTUDENTSCIPER;
const doctoratID = process.env.PHDSTUDENTDOCTORAT;
const pdfToRead = process.env.PDFNAMETOREAD;
describe('Testing GED deposit', async () => {
    it('should get a ticket', async () => {
        const ticket = await (0, src_1.fetchTicket)(process.env.ALFRESCO_USERNAME, process.env.ALFRESCO_PASSWORD, process.env.ALFRESCO_URL);
        (0, chai_1.expect)(ticket).to.not.be.empty;
    });
    it('should read the student folder', async () => {
        const ticket = await (0, src_1.fetchTicket)(process.env.ALFRESCO_USERNAME, process.env.ALFRESCO_PASSWORD, process.env.ALFRESCO_URL);
        const alfrescoStudentsFolderURL = (0, src_1.getStudentFolderURL)(phdStudentName, phdStudentSciper, doctoratID, ticket, process.env.ALFRESCO_URL);
        await (0, src_1.readFolder)(alfrescoStudentsFolderURL);
    });
    it('should fetch a pdf as a base64 string', async () => {
        const ticket = await (0, src_1.fetchTicket)(process.env.ALFRESCO_USERNAME, process.env.ALFRESCO_PASSWORD, process.env.ALFRESCO_URL);
        const alfrescoStudentsFolderURL = (0, src_1.getStudentFolderURL)(phdStudentName, phdStudentSciper, doctoratID, ticket, process.env.ALFRESCO_URL);
        const pdfAsBase64 = await (0, src_1.fetchFileAsBase64)(alfrescoStudentsFolderURL, pdfToRead);
        (0, chai_1.expect)(pdfAsBase64).to.not.be.empty;
        // can we decode this with base64 ?
        (0, chai_1.expect)(() => btoa(atob(pdfAsBase64))).to.not.throw();
    });
    it('should stream a pdf to a file', async () => {
        const ticket = await (0, src_1.fetchTicket)(process.env.ALFRESCO_USERNAME, process.env.ALFRESCO_PASSWORD, process.env.ALFRESCO_URL);
        const alfrescoStudentsFolderURL = (0, src_1.getStudentFolderURL)(phdStudentName, phdStudentSciper, doctoratID, ticket, process.env.ALFRESCO_URL);
        const destinationPath = path.join('/tmp', pdfToRead);
        if (fs.existsSync(destinationPath))
            fs.unlinkSync(destinationPath);
        (0, chai_1.expect)(destinationPath).to.not.be.a.path();
        // Set the stream
        const alfrescoStream = (0, src_1.getFileStream)(alfrescoStudentsFolderURL, pdfToRead);
        const fileStream = fs.createWriteStream(destinationPath);
        // Pipe them
        // from https://github.com/sindresorhus/got/blob/v12.6.1/documentation/3-streams.md
        const pipeline = (0, node_util_1.promisify)(node_stream_1.default.pipeline);
        await pipeline(alfrescoStream, fileStream);
        (0, chai_1.expect)(destinationPath).to.be.a.path();
    });
    // it('should upload the pdf to the student folder', async () => {
    //
    //   const pdfFileName = `Rapport annuel doctorat.pdf`
    //   const base64String = process.env.PDFSTRING!
    //   const pdfFile = Buffer.from(base64String, 'base64')
    //
    //   const ticket = await fetchTicket()
    //
    //   const alfrescoStudentsFolderURL = getStudentFolderURL(phdStudentName,
    //       phdStudentSciper,
    //       doctoratID,
    //       ticket
    //   )
    //
    //   await uploadPDF(alfrescoStudentsFolderURL, pdfFileName, pdfFile)
    //
    // })
});
