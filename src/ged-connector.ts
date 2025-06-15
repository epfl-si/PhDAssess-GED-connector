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


export type StudentInfo = {
  studentName: string,
  sciper: string,
  doctoralAcronym: string,
}

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

export const getStudentFolderRelativeUrl = (
  studentInfo: StudentInfo
): string => {
  const studentFolderName = `${ studentInfo.studentName }, ${ studentInfo.sciper }`
  const doctoratName = _.find(ecolesDoctorales, {id: studentInfo.doctoralAcronym})?.label ?? studentInfo.doctoralAcronym

  const studentsFolderURL =
    `/alfresco/api/-default-/public/cmis/versions/1.1/browser/root/Etudiants/Dossiers%20Etudiants/${encodeURIComponent(studentFolderName)}/${encodeURIComponent(doctoratName)}/Cursus`

  return studentsFolderURL
}

/**
 * Get the full path to the student folder.
 * Set the fileName parameter if you need to get a path to a file
 */
const buildAlfrescoFullUrl = (
  alfrescoBaseUrl: string,
  studentInfo: StudentInfo,
  ticket: string,
  fileName = ''
) => {
  let studentPath = new URL(
    getStudentFolderRelativeUrl(studentInfo),
    alfrescoBaseUrl
  )

  if (fileName) studentPath.pathname += `/${ fileName }`

  // add auth and format parameter
  studentPath.searchParams.set('alf_ticket', ticket)
  studentPath.searchParams.set('format', 'json')

  return studentPath
};

export const readFolder = async (
  alfrescoBaseUrl: string,
  studentInfo: StudentInfo,
  ticket: string
) => {
  const folderFullPath = buildAlfrescoFullUrl(
    alfrescoBaseUrl,
    studentInfo,
    ticket,
  )

  debug(`Reading student folder info ${ folderFullPath }`)

  const studentFolderJsonInfo: JSON = await got.get(folderFullPath, {}).json()

  if (studentFolderJsonInfo && Object.keys(studentFolderJsonInfo).length) {
    debug(`Successfully accessed the student folder`)
  } else {
    debug(`Fetched a student folder but empty`)
  }
}

/**
 * Get a pdf file in a base64 format
 */
export const fetchFileAsBase64 = async (
  alfrescoBaseUrl: string,
  studentInfo: StudentInfo,
  ticket: string,
  fileName: string
) => {

  const fullPath = buildAlfrescoFullUrl(
    alfrescoBaseUrl,
    studentInfo,
    ticket,
    fileName
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

/**
 * Get a duplex stream to a file on alfresco
 */
export const getFileStream = (
  alfrescoBaseUrl: string,
  studentInfo: StudentInfo,
  ticket: string,
  fileName: string
) => {
  // see tests to get an example of this stream usage
  const fullPath = buildAlfrescoFullUrl(
    alfrescoBaseUrl,
    studentInfo,
    ticket,
    fileName
  )

  debug(`Getting a stream for '${fullPath}'`)

  return got.stream(fullPath, {})
}

export const uploadPDF = async (
  alfrescoBaseUrl: string,
  studentInfo: StudentInfo,
  ticket: string,
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

  const fullPath = buildAlfrescoFullUrl(
    alfrescoBaseUrl,
    studentInfo,
    ticket
  )

  await got.post(
    fullPath,
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
