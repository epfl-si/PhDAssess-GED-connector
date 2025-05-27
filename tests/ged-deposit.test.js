"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Here you can manually test the GED deposit.
 * Please set the .env correctly, you don't want to use production
 */
require('dotenv').config();
require("mocha");
const chai_1 = require("chai");
const ged_connector_1 = require("../src/ged-connector");
const phdStudentName = process.env.PHDSTUDENTNAME;
const phdStudentSciper = process.env.PHDSTUDENTSCIPER;
const doctoratID = process.env.PHDSTUDENTDOCTORAT;
const pdfToRead = process.env.PDFNAMETOREAD;
const pdfFileName = `Rapport annuel doctorat.pdf`;
const base64String = process.env.PDFSTRING;
const pdfFile = Buffer.from(base64String, 'base64');
describe('Testing GED deposit', async () => {
    it('should get a ticket', async () => {
        const ticket = await (0, ged_connector_1.fetchTicket)(process.env.ALFRESCO_USERNAME, process.env.ALFRESCO_PASSWORD, process.env.ALFRESCO_URL);
        (0, chai_1.expect)(ticket).to.not.be.empty;
    });
    it('should read the student folder', async () => {
        const ticket = await (0, ged_connector_1.fetchTicket)(process.env.ALFRESCO_USERNAME, process.env.ALFRESCO_PASSWORD, process.env.ALFRESCO_URL);
        const alfrescoStudentsFolderURL = await (0, ged_connector_1.getStudentFolderURL)(phdStudentName, phdStudentSciper, doctoratID, ticket, process.env.ALFRESCO_URL);
        await (0, ged_connector_1.readFolder)(alfrescoStudentsFolderURL);
    });
    it('should save a pdf', async () => {
        const ticket = await (0, ged_connector_1.fetchTicket)(process.env.ALFRESCO_USERNAME, process.env.ALFRESCO_PASSWORD, process.env.ALFRESCO_URL);
        const alfrescoStudentsFolderURL = await (0, ged_connector_1.getStudentFolderURL)(phdStudentName, phdStudentSciper, doctoratID, ticket, process.env.ALFRESCO_URL);
        await (0, ged_connector_1.downloadFile)(alfrescoStudentsFolderURL, pdfToRead, `/tmp/${pdfToRead}`);
    });
    // it('should upload the pdf to the student folder', async () => {
    //   const ticket = await fetchTicket()
    //   const alfrescoStudentsFolderURL = await getStudentFolderURL(phdStudentName,
    //       phdStudentSciper,
    //       doctoratID,
    //       ticket
    //   )
    //   await uploadPDF(alfrescoStudentsFolderURL, pdfFileName, pdfFile)
    // })
});
