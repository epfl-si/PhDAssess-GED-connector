/*
 * Here you can manually test the GED deposit.
 * Please set the .env correctly, you don't want to use production
 */
import * as path from "node:path";
import * as fs from 'node:fs';
import {promisify} from 'node:util';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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

const checkForPdfBase64StringValidity = async (pdfAsBase64: string) => {
  expect(pdfAsBase64).to.not.be.empty;

  // can we decode this with base64 ?
  expect(
    () => btoa(atob(pdfAsBase64))
  ).to.not.throw()

  // can we open this as pdf ?
  const buffer = Buffer.from(pdfAsBase64, 'base64')
  const pdfGeneratedUint8 = new Uint8Array(buffer)

  const pdf = getDocument({ data: pdfGeneratedUint8 })
  const doc = await pdf.promise

  expect(doc).to.not.be.empty
  expect(doc.numPages).to.be.greaterThan(0)
}


describe('Testing GED deposit', async () => {

  let pdfFullPath = process.env.PDFANNEXPATH!

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


  it('should upload a pdf file to the student folder. The pdf become a base 64, then a form data.', async () => {

    // don't do this test if it looks like we are in a non-test server
    if (!process.env.ALFRESCO_URL!.includes('test')) throw new Error(`Failing test because the server may be the production`)

    // read the pdf file to base64
    const pdfFile = fs.readFileSync(__dirname + '/sample.pdf',);
    const base64String = pdfFile.toString('base64');

    const pdfFileName = `Rapport annuel doctorat-allo2.pdf`
    const pdfFileBuffer = Buffer.from(base64String, 'base64')

    const ticket = await fetchTicket(alfrescoInfo)

    pdfFullPath = await uploadPDF(
      alfrescoInfo,
      studentInfo,
      ticket,
      pdfFileName,
      pdfFileBuffer
    ) as string

    // Try to read back the file
    const pdfAsBase64 = await fetchFileAsBase64(
      pdfFullPath,
      ticket
    )

    await checkForPdfBase64StringValidity(pdfAsBase64)

  }).timeout(10000)  // 2000, the default, is not enough for this operation


  it('should fetch a pdf as a base64 string', async () => {

    const ticket = await fetchTicket(alfrescoInfo)

    expect(pdfFullPath, 'Please set up the env var PDFANNEXPATH correctly').to.not.be.empty;

    const pdfAsBase64 = await fetchFileAsBase64(
      pdfFullPath,
      ticket,
    )

    expect(pdfAsBase64).to.not.be.empty;

    // can we decode this with base64 ?
    expect(
      () => btoa(atob(pdfAsBase64))
    ).to.not.throw()

    await checkForPdfBase64StringValidity(pdfAsBase64)

  })


  it('should stream a pdf to a file', async () => {

    expect(pdfFullPath, 'Please set up the env var PDFANNEXPATH correctly').to.not.be.empty;

    const ticket = await fetchTicket(alfrescoInfo)

    const destinationPath = path.join('/tmp', pdfFullPath.split('/').pop()!)

    if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath)

    expect(destinationPath).to.not.be.a.path();

    // set a timeout
    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 40000);

    // Set the stream to the remote file
    const alfrescoStream = await getFileStream(
      pdfFullPath,
      ticket,
      controller
    )

    try {
      // Set the stream to the filesystem
      const fileStream = fs.createWriteStream(destinationPath)

      // Pipe them
      // from https://github.com/sindresorhus/got/blob/v12.6.1/documentation/3-streams.md
      const pipeline = promisify(stream.pipeline);

      await pipeline(
        alfrescoStream.body,
        fileStream,
      )
    } catch (error) {
      throw error
    } finally {
      clearTimeout(timeout);
    }

    expect(destinationPath).to.be.a.path();
    const pdf = getDocument(destinationPath)
    const doc = await pdf.promise

    expect(doc).to.not.be.empty
    expect(doc.numPages).to.be.greaterThan(0)

  })

}).timeout(5000);  // raise the default, sometimes we can have lag spikes
