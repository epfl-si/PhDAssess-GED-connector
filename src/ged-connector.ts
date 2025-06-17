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
import {
  AlfrescoInfo,
  StudentInfo
} from './types';

const debug = debug_('ged-connector')

const alfrescoRequestTimeoutMS = 40000  // 40 seconds

export const fetchTicket = async (
  { serverUrl, username, password }: AlfrescoInfo
): Promise<string> => {
  debug(`Using server ${ serverUrl }`)

  if (username && password) {
    const alfrescoLoginUrl = new URL(`/alfresco/service/api/login`, serverUrl)

    alfrescoLoginUrl.search = `u=${ username }&pw=${ password }&format=json`

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
  serverUrl: string,
  studentInfo: StudentInfo,
  ticket: string,
  fileName = ''
) => {
  let studentPath = new URL(
    getStudentFolderRelativeUrl(studentInfo),
    serverUrl
  )

  if (fileName) studentPath.pathname += `/${ fileName }`

  // add auth and format parameter
  studentPath.searchParams.set('alf_ticket', ticket)
  studentPath.searchParams.set('format', 'json')

  return studentPath
};

/**
 * Get info about a folder based on the provided student info
 *
 * @param alfrescoBaseUrl
 * @param studentInfo
 * @param ticket
 */
export const readFolder = async (
  { serverUrl }: AlfrescoInfo,
  studentInfo: StudentInfo,
  ticket: string
) => {
  const folderFullPath = buildAlfrescoFullUrl(
    serverUrl,
    studentInfo,
    ticket,
  )

  debug(`Reading student folder info ${ folderFullPath }`)

  try {
    const studentFolderJsonInfo: JSON = await got.get(folderFullPath, {}).json()

    if (studentFolderJsonInfo && Object.keys(studentFolderJsonInfo).length) {
      debug(`Successfully accessed the student folder ${JSON.stringify(studentFolderJsonInfo)}`)
    } else {
      debug(`Fetched a student folder but empty ${studentFolderJsonInfo}`)
    }
  } catch(error: any) {
    if (error.response?.statusCode) {
      error.message += `. URL used: ${folderFullPath}`
      throw error
    }
  }
}

/**
 * Get a pdf file in a base64 format
 */
export const fetchFileAsBase64 = async (
  { serverUrl }: AlfrescoInfo,
  studentInfo: StudentInfo,
  ticket: string,
  fileName: string
) => {

  const fullPath = buildAlfrescoFullUrl(
    serverUrl,
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
  { serverUrl }: AlfrescoInfo,
  studentInfo: StudentInfo,
  ticket: string,
  fileName: string
) => {
  // see tests to get an example of this stream usage
  const fullPath = buildAlfrescoFullUrl(
    serverUrl,
    studentInfo,
    ticket,
    fileName
  )

  debug(`Getting a stream for '${fullPath}'`)

  return got.stream(fullPath, {})
}

/**
 * Upload a file and return the name that finally fit.
 * Name can change from the provided one as it may already have one, so
 * we rename it to copy next to the already set one
 */
export const uploadPDF = async (
  { serverUrl }: AlfrescoInfo,
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
  form.set('succinct', 'true')

  const pdfBlob = new File([pdfFile], pdfFileName)
  form.set('file', pdfBlob)

  const fullPath = buildAlfrescoFullUrl(
    serverUrl,
    studentInfo,
    ticket
  )

  // we may need to change the filename
  let finalPdfFileName = pdfFileName
  const maxRetry = 50
  let attempt = 0

  while (attempt < maxRetry) {
    try {
      form.set('propertyValue[1]', finalPdfFileName)
      const encoder = new FormDataEncoder(form as FormDataLike)

      debug(`Trying to deposit the file ${finalPdfFileName}`)

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

      debug(`Successfully uploaded a file. Requested name : ${pdfFileName}. Final name : ${finalPdfFileName}`)

      return finalPdfFileName

    } catch(error: any) {
      if (error.response?.statusCode === 409) {
        // retry with a different name
        debug(`The File name conflict. Retrying`)
        // the regex allows to capture the filename extension (.pdf)
        attempt++

        // add the _v1, or increment
        finalPdfFileName = finalPdfFileName.match(/_v(\d+)(\.[^.]*)$/)
          ? finalPdfFileName.replace(/_v(\d+)(\.[^.]*)$/, (_, v, ext) => `_v${+v + 1}${ext}`)
          : finalPdfFileName.replace(/(\.[^.]*)$/, "_v1$1");
      } else {
        throw error; // Rethrow or handle other errors as needed
      }
    }
  }
}
