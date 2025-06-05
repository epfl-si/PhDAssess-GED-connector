/*
 * Here you can manually test the GED deposit.
 * Please set the .env correctly, you don't want to use production
 */
import * as path from "node:path";
import * as fs from 'node:fs/promises';

require('dotenv').config()

import 'mocha'
import { expect } from 'chai';

import {
  getStudentFolderURL,
  fetchTicket,
  readFolder,
  uploadPDF,
  downloadFile
} from "../src/ged-connector";

const phdStudentName = process.env.PHDSTUDENTNAME!
const phdStudentSciper = process.env.PHDSTUDENTSCIPER!
const doctoratID = process.env.PHDSTUDENTDOCTORAT!
const pdfToRead= process.env.PDFNAMETOREAD!

const pdfFileName = `Rapport annuel doctorat.pdf`
const base64String = process.env.PDFSTRING!
const pdfFile = Buffer.from(base64String, 'base64')

describe('Testing GED deposit', async () =>{
  it('should get a ticket', async () => {
    const ticket = await fetchTicket(
      process.env.ALFRESCO_USERNAME!,
      process.env.ALFRESCO_PASSWORD!,
      process.env.ALFRESCO_URL!
    )
    expect(ticket).to.not.be.empty
  })

  it('should read the student folder', async () => {
    const ticket = await fetchTicket(
      process.env.ALFRESCO_USERNAME!,
      process.env.ALFRESCO_PASSWORD!,
      process.env.ALFRESCO_URL!
    )
    const alfrescoStudentsFolderURL = await getStudentFolderURL(phdStudentName,
        phdStudentSciper,
        doctoratID,
        ticket,
        process.env.ALFRESCO_URL!
    )
    await readFolder(alfrescoStudentsFolderURL)
  })

  it('should save a pdf', async () => {
    const ticket = await fetchTicket(
      process.env.ALFRESCO_USERNAME!,
      process.env.ALFRESCO_PASSWORD!,
      process.env.ALFRESCO_URL!
    )
    const alfrescoStudentsFolderURL = await getStudentFolderURL(phdStudentName,
      phdStudentSciper,
      doctoratID,
      ticket,
      process.env.ALFRESCO_URL!
    )
    const destinationPath = path.join('/tmp', pdfToRead)
    await downloadFile(
      alfrescoStudentsFolderURL,
      pdfToRead,
      destinationPath
    )
    expect(destinationPath).to.not.be.empty;
  })

  // it('should upload the pdf to the student folder', async () => {
  //
  //   const ticket = await fetchTicket()
  //
  //   const alfrescoStudentsFolderURL = await getStudentFolderURL(phdStudentName,
  //       phdStudentSciper,
  //       doctoratID,
  //       ticket
  //   )
  //
  //   await uploadPDF(alfrescoStudentsFolderURL, pdfFileName, pdfFile)
  //
  // })
})
