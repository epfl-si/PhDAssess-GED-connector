/*
 * Here you can manually test the GED deposit.
 * Please set the .env correctly, you don't want to use production
 */
import * as path from "node:path";
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import {promisify} from 'node:util';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import stream from 'node:stream';
import { AbortController } from "node-abort-controller";
import { makeid } from "./lib/filenames";

require('dotenv').config()

import 'mocha'
import * as chai from 'chai';
import { expect } from 'chai';
chai.use(require('chai-fs'));
chai.use(require('chai-bytes'));

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

// Exclude some test if it looks like we are in a non-test server
const abortWritingTestIfProd = () => {
  if (!process.env.ALFRESCO_URL!.includes('test')) {
    throw new Error(
      `Failing test because the server may be the production`
    )
  }
}

async function getPdfSampleBytes (fromPath = __dirname + '/sample.pdf') {
  return await fsp.readFile(fromPath)
}


let ticket = ''
let pdfUploadedPath = ''  // will receive the uploaded PDF path
let pdfFile: Buffer
let pdfFileName: string


describe('Testing GED deposit and readability', async () => {

  before(async () => {
    abortWritingTestIfProd();

    ticket = await fetchTicket(alfrescoInfo)

    // the PDF sample used to do the upload
    pdfFile = await getPdfSampleBytes();
    pdfFileName = `Rapport-${ makeid() }.pdf`
  })

  beforeEach(async () => {
    // set an upload if we don't already, allowing to run test independently
    if (!pdfUploadedPath) {
      pdfUploadedPath = await uploadPDF(
        alfrescoInfo,
        studentInfo,
        ticket,
        pdfFileName,
        pdfFile
      ) as string
    }
  })

  it('should have the ticket', async () => {
    expect(ticket).to.not.be.empty
  })

  it('should read the student folder', async () => {
    await readFolder(
      alfrescoInfo,
      studentInfo,
      ticket
    )
  })

  it('should upload a pdf file to the student folder', async () => {

    expect(pdfUploadedPath).to.not.be.empty

  })

  it('should download and check that is the same file', async () => {

    expect(
      pdfUploadedPath,
      'This test is part of a scenario. Please assert a file has been uploaded firstly'
    ).to.not.be.empty

    const pdfAsBase64 = await fetchFileAsBase64(
      pdfUploadedPath,
      ticket
    )

    expect(
      Buffer.from(pdfAsBase64, "base64")
    // @ts-ignore
    ).to.equalBytes(pdfFile)

  })

  it('should pick another filename when uploading to a file with a name that already exists', async () => {

    expect(
      pdfUploadedPath,
      'This test is part of a scenario. Please assert a file has been uploaded firstly'
    ).to.not.be.empty

    const ticket = await fetchTicket(alfrescoInfo)

    const pdfUploadedPath2 = await uploadPDF(
      alfrescoInfo,
      studentInfo,
      ticket,
      pdfUploadedPath!.split('/')!.pop()!,
      pdfFile
    ) as string

    expect(
      pdfUploadedPath2,
      `${ pdfUploadedPath.split('/')!.pop()! } should not equal ${ pdfUploadedPath2.split('/')!.pop()! }`
    ).to.not.equal(pdfUploadedPath)
  })

  it('should fetch the pdf as a base64 string and be openable as PDF', async () => {

    expect(
      pdfUploadedPath,
      'This test is part of a scenario. Please assert a file has been uploaded firstly'
    ).to.not.be.empty

    const pdfAsBase64 = await fetchFileAsBase64(
      pdfUploadedPath,
      ticket,
    )

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

  })

  it('should stream a pdf to a file', async () => {

    const destinationPath = path.join('/tmp', pdfFileName)

    if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath)

    expect(destinationPath).to.not.be.a.path();

    // set a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 40000);

    // Set the stream to the remote file
    const alfrescoStream = await getFileStream(
      pdfUploadedPath,
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
    console.log(`Successfully written the file ${ destinationPath}`)
    const pdf = getDocument(destinationPath)
    const doc = await pdf.promise

    expect(doc).to.not.be.empty
    expect(doc.numPages).to.be.greaterThan(0)

  })

}).timeout(5000);  // raise the default, operation are network dependent
