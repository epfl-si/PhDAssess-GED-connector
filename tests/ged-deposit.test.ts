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
  // uploadPDF,
  fetchFileAsBase64,
  getFileStream, uploadPDF
} from "../src";

const phdStudentName = process.env.PHDSTUDENTNAME!
const phdStudentSciper = process.env.PHDSTUDENTSCIPER!
const doctoralAcronym = process.env.PHDSTUDENTDOCTORATACRONYM!
const pdfToRead= process.env.PDFNAMETOREAD!


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

    await readFolder(
      process.env.ALFRESCO_URL!,
      {
        studentName: phdStudentName,
        sciper: phdStudentSciper,
        doctoralAcronym: doctoralAcronym,
      },
      ticket
    )
  })

  it('should fetch a pdf as a base64 string', async () => {

    const ticket = await fetchTicket(
      process.env.ALFRESCO_USERNAME!,
      process.env.ALFRESCO_PASSWORD!,
      process.env.ALFRESCO_URL!
    )

    const pdfAsBase64 = await fetchFileAsBase64(
      process.env.ALFRESCO_URL!,
      {
        studentName: phdStudentName,
        sciper: phdStudentSciper,
        doctoralAcronym: doctoralAcronym,
      },
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

    const ticket = await fetchTicket(
      process.env.ALFRESCO_USERNAME!,
      process.env.ALFRESCO_PASSWORD!,
      process.env.ALFRESCO_URL!
    )

    const destinationPath = path.join('/tmp', pdfToRead)

    if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath)

    expect(destinationPath).to.not.be.a.path();

    // Set the stream to the remote file
    const alfrescoStream = getFileStream(
      process.env.ALFRESCO_URL!,
      {
        studentName: phdStudentName,
        sciper: phdStudentSciper,
        doctoralAcronym: doctoralAcronym,
      },
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


  // don't do this test if it looks like we are in a non-test server
  !process.env.ALFRESCO_URL!.includes('test') ? it.skip : it
    ('should upload the pdf to the student folder', async () => {

      const pdfFileName = `Rapport annuel doctorat.pdf`
      const base64String = process.env.PDFSTRING!
      const pdfFileBuffer = Buffer.from(base64String, 'base64')

      const ticket = await fetchTicket(
        process.env.ALFRESCO_USERNAME!,
        process.env.ALFRESCO_PASSWORD!,
        process.env.ALFRESCO_URL!
      )

      await uploadPDF(
        process.env.ALFRESCO_URL!,
        {
          studentName: phdStudentName,
          sciper: phdStudentSciper,
          doctoralAcronym: doctoralAcronym,
        },
        ticket,
        pdfFileName,
        pdfFileBuffer
      )

      // Try to read back the file
      const pdfAsBase64 = await fetchFileAsBase64(
        process.env.ALFRESCO_URL!,
        {
          studentName: phdStudentName,
          sciper: phdStudentSciper,
          doctoralAcronym: doctoralAcronym,
        },
        ticket,
        pdfFileName
      )

      expect(pdfAsBase64).to.not.be.empty;

      // can we decode this with base64 ?
      expect(
        () => btoa(atob(pdfAsBase64))
      ).to.not.throw()
    })
})
