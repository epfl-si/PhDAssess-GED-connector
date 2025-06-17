/*
 * Here you can manually test the GED deposit.
 * Please set the .env correctly, you don't want to use production
 */
import * as path from "node:path";
import * as fs from 'node:fs';
import {promisify} from 'node:util';
import stream from 'node:stream';

require('dotenv').config()

import 'mocha'
import * as chai from 'chai';
import { expect } from 'chai';
chai.use(require('chai-fs'));

import {
  fetchTicket,
  readFolder,
  uploadPDF,
  fetchFileAsBase64,
  getFileStream,
  StudentInfo,
  AlfrescoInfo
} from "../src";


const pdfToRead= process.env.PDFNAMETOREAD!

const studentInfo: StudentInfo = {
  doctoralAcronym: process.env.PHDSTUDENTDOCTORATACRONYM!,
  studentName: process.env.PHDSTUDENTNAME!,
  sciper: process.env.PHDSTUDENTSCIPER!,
}

const alfrescoInfo: AlfrescoInfo = {
  serverUrl: process.env.ALFRESCO_URL!,
  username: process.env.ALFRESCO_USERNAME!,
  password: process.env.ALFRESCO_PASSWORD!,
}


describe('Testing GED deposit', async () => {

  it('should get a ticket', async () => {

    const ticket = await fetchTicket(alfrescoInfo)

    expect(ticket).to.not.be.empty

  })

  it('should read the student folder', async () => {

    const ticket = await fetchTicket(alfrescoInfo)

    await readFolder(
      alfrescoInfo,
      studentInfo,
      ticket
    )
  })

  it('should fetch a pdf as a base64 string', async () => {

    const ticket = await fetchTicket(alfrescoInfo)

    const pdfAsBase64 = await fetchFileAsBase64(
      alfrescoInfo,
      studentInfo,
      ticket,
      pdfToRead
    )

    expect(pdfAsBase64).to.not.be.empty;

    // can we decode this with base64 ?
    expect(
      () => btoa(atob(pdfAsBase64))
    ).to.not.throw()

  })

  it('should stream a pdf to a file', async () => {

    const ticket = await fetchTicket(alfrescoInfo)

    const destinationPath = path.join('/tmp', pdfToRead)

    if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath)

    expect(destinationPath).to.not.be.a.path();

    // Set the stream to the remote file
    const alfrescoStream = getFileStream(
      alfrescoInfo,
      studentInfo,
      ticket,
      pdfToRead,
    )

    // Set the stream to the filesystem
    const fileStream = fs.createWriteStream(destinationPath)

    // Pipe them
    // from https://github.com/sindresorhus/got/blob/v12.6.1/documentation/3-streams.md
    const pipeline = promisify(stream.pipeline);

    await pipeline(
      alfrescoStream,
      fileStream,
    )

    expect(destinationPath).to.be.a.path();

  })

  it('should upload the pdf to the student folder', async () => {

    // don't do this test if it looks like we are in a non-test server
    if (!process.env.ALFRESCO_URL!.includes('test')) throw new Error(`Failing test because the server may be the production`)

    const pdfFileName = `Rapport annuel doctorat.pdf`
    const base64String = process.env.PDFSTRING!
    const pdfFileBuffer = Buffer.from(base64String, 'base64')

    const ticket = await fetchTicket(alfrescoInfo)

    const newPdfFileName = await uploadPDF(
      alfrescoInfo,
      studentInfo,
      ticket,
      pdfFileName,
      pdfFileBuffer
    )

    // Try to read back the file
    const pdfAsBase64 = await fetchFileAsBase64(
      alfrescoInfo,
      studentInfo,
      ticket,
      newPdfFileName!
    )

    expect(pdfAsBase64).to.not.be.empty;

    // can we decode this with base64 ?
    expect(
      () => btoa(atob(pdfAsBase64))
    ).to.not.throw()
  })

})
