// set timeout and retry values

import debug_ from 'debug'
import * as _ from "lodash";
import got from 'got'
import {promisify} from 'node:util';
import stream from 'node:stream';
import {Readable} from "stream"
import {URL} from "url";
import {FormData, File} from 'formdata-node'
// @ts-ignore
import {FormDataEncoder, FormDataLike} from "form-data-encoder"
import {ecolesDoctorales} from "./doctorats"
import {AlfrescoTicketResponse} from "./alfresco_types"

const debug = debug_('ged-connector')

export const alfrescoBaseURL = process.env.ALFRESCO_URL
const alfrescoRequestTimeoutMS = 40000  // 40 seconds


export const fetchTicket = async (
  alfrescoUsername: string,
  alfrescoPassword: string,
  alfrescoServerURL: string,
): Promise<string> => {

  debug(`Using server ${alfrescoServerURL}`)

  if (alfrescoUsername && alfrescoPassword) {
    const alfrescoLoginUrl = new URL(`/alfresco/service/api/login`, alfrescoServerURL)

    alfrescoLoginUrl.search = `u=${alfrescoUsername}&pw=${alfrescoPassword}&format=json`

    const dataTicket = await got.get(alfrescoLoginUrl, {
      timeout: {
        request: alfrescoRequestTimeoutMS
      },
      retry: {
        limit: 0
      },
    }).json() as AlfrescoTicketResponse

    debug(`Asked for the alfresco ticket and got ${JSON.stringify(dataTicket)}`)

    if (!dataTicket.data.ticket) throw new Error(
      `Alresco answered but did not give any ticket. Returned data : ${JSON.stringify(dataTicket)}`
    )

    return dataTicket.data.ticket
  } else {
    throw new Error(`Missing environment variables to ALFRESCO_USERNAME and/or ALFRESCO_PASSWORD`)
  }
}

export const getStudentFolderURL = (
  studentName: string,
  sciper: string,
  doctoralID: string,
  ticket: string,
  alfrescoServerURL: string
): URL => {
  const studentFolderName = `${studentName}, ${sciper}`
  const doctoratName = _.find(ecolesDoctorales, {id: doctoralID})?.label ?? doctoralID

  const StudentsFolderURL = new URL(
    `/alfresco/api/-default-/public/cmis/versions/1.1/browser/root/Etudiants/Dossiers%20Etudiants/${encodeURIComponent(studentFolderName)}/${encodeURIComponent(doctoratName)}/Cursus`,
    alfrescoServerURL
  )

  StudentsFolderURL.search = `alf_ticket=${ticket}&format=json`

  debug(`Using student folder with url ${StudentsFolderURL}`)
  return StudentsFolderURL
}

export const readFolder = async (
  studentFolder: URL
) => {
  const studentFolderInfo = await got.get(studentFolder, {}).json()
  debug(`Fetched ${JSON.stringify(studentFolderInfo, null, 2)}`)
}

/**
 * Get a duplex stream to a file on alfresco
 * @param studentFolder
 * @param fileName
 */
export const getFileStream = (
  studentFolder: URL,
  fileName: string
) => {
  // see tests to get an example of this stream usage

  // reconstruct the url to add the filename
  const urlParameters = studentFolder.searchParams
  const fullPath = new URL(
    'Cursus/' + fileName + '?' + urlParameters,
    studentFolder
  )

  debug(`Getting a stream for '${fullPath}'`)

  return got.stream(
    fullPath, {}
  )
}

/**
 * Get a pdf file in a base64 format
 */
export const fetchFileAsBase64 = async (
  studentFolder: URL,
  fileName: string
) => {

  // reconstruct the url to add the filename
  const urlParameters = studentFolder.searchParams
  const fullPath = new URL(
    'Cursus/' + fileName + '?' + urlParameters,
    studentFolder
  )

  debug(`Getting file '${fullPath}' to save as buffer`)

  const response = await got(
    fullPath,
    {
      responseType: 'buffer'
    }
  )

  return response.body.toString('base64')
}

export const uploadPDF = async (
  studentFolder: URL,
  pdfFileName: string,
  pdfFile: Buffer
) => {
  const form = new FormData()
  form.set('cmisaction', 'createDocument')
  form.set('propertyId[0]', 'cmis:objectTypeId')
  form.set('propertyValue[0]', 'cmis:document')
  form.set('propertyId[1]', 'cmis:name')
  form.set('propertyValue[1]', pdfFileName)
  form.set('succinct', 'true')

  const pdfBlob = new File([pdfFile], pdfFileName)

  form.set('file', pdfBlob)
  const encoder = new FormDataEncoder(form as FormDataLike)

  await got.post(
    studentFolder,
    {
      body: Readable.from(encoder.encode()),
      headers: encoder.headers,
      timeout: {
        request: alfrescoRequestTimeoutMS
      },
      retry: {
        limit: 0
      },
    }
  )
}
