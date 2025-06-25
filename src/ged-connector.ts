// set timeout and retry values

import debug_ from 'debug'
import * as _ from "lodash";
import {URL} from "url";
import {Readable} from "stream"
import
  fetch,
  {AbortError}
from 'node-fetch';
import {FormData, File} from 'formdata-node';

// @ts-ignore
import {FormDataEncoder} from "form-data-encoder";
import {AbortController} from "node-abort-controller";

import {ecolesDoctorales} from "./doctorats"
import {AlfrescoTicketResponse} from "./alfresco_types"
import {
  AlfrescoInfo,
  StudentInfo
} from './types';

const debug = debug_('ged-connector')

const alfrescoRequestTimeoutMS = 40000  // 40 seconds

const appendTicketToUrl = (
  url: string | URL,
  ticket: string
) => {
  if (!(url instanceof URL)) {
    url = new URL(url)
  }
  url.searchParams.set('alf_ticket', ticket)
  return url
}

export const fetchTicket = async (
  { serverUrl, username, password }: AlfrescoInfo
): Promise<string> => {
  debug(`Using server ${ serverUrl }`)

  if (!username || !password) throw new Error(`Missing username or password to connect to the remote server`)

  const alfrescoLoginUrl = new URL(`/alfresco/service/api/login`, serverUrl)

  alfrescoLoginUrl.search = `u=${ username }&pw=${ password }&format=json`

  // set a timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, alfrescoRequestTimeoutMS);

  try {
    const response = await fetch(
      alfrescoLoginUrl,
      // @ts-ignore
      { signal: controller.signal }
    );

    if (!response.ok) throw new Error(
      `Alfresco answered with a response error. Returned error: ${response}`
    )

    const dataTicket = await response.json() as AlfrescoTicketResponse

    debug(`Asked for the alfresco ticket and got ${JSON.stringify(dataTicket)}`)

    if (!dataTicket.data.ticket) throw new Error(
      `Alfresco answered but did not give any ticket. Returned data : ${JSON.stringify(dataTicket)}`
    )

    return dataTicket.data.ticket

  } catch (error) {
    if (error instanceof AbortError) {
      throw new Error(`Request on ${ serverUrl } was aborted or got a timeout`);
    } else {
      throw error
    }
  } finally {
    clearTimeout(timeout);
  }
}

export const getStudentFolderRelativeUrl = (
  studentInfo: StudentInfo
): string => {
  const studentFolderName = `${ studentInfo.studentName }, ${ studentInfo.sciper }`
  const doctoratName = _.find(
    ecolesDoctorales,
    {id: studentInfo.doctoralAcronym}
  )?.label ?? studentInfo.doctoralAcronym

  return `/alfresco/api/-default-/public/cmis/versions/1.1/browser/root/` +
    `Etudiants/Dossiers%20Etudiants/${encodeURIComponent(studentFolderName)}/${encodeURIComponent(doctoratName)}/Cursus`
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

  // set a timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, alfrescoRequestTimeoutMS);

  debug(`Reading student folder info ${ folderFullPath }`)

  try {
    const response = await fetch(
      folderFullPath,
      // @ts-ignore
      { signal: controller.signal }
    )

    if (!response.ok) throw new Error(
      `${serverUrl} answered with a HTTP response error: ${ response.status }, ${ response.statusText } }`
    )

    const studentFolderJsonInfo: JSON = await response.json()

    if (studentFolderJsonInfo && Object.keys(studentFolderJsonInfo).length) {
      debug(`Successfully accessed the student folder`)
    } else {
      debug(`Fetched a student folder but empty ${studentFolderJsonInfo}`)
    }
  } catch(error: any) {
    if (error instanceof AbortError) {
      throw new Error('request was aborted or got a timeout');
    } else if (error.response?.statusCode) {
      error.message += `. URL used: ${folderFullPath}`
      throw error
    } else {
      throw error
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get a pdf file in a base64 format
 */
export const fetchFileAsBase64 = async (
  filePath: string,
  ticket: string,
) => {
  const filePathUrl = appendTicketToUrl(filePath, ticket)

  debug(`Getting file '${ filePathUrl }' to save as buffer`)

  // set a timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, alfrescoRequestTimeoutMS);

  try {
    const response = await fetch(
      filePathUrl,
      // @ts-ignore
      { signal: controller.signal }
    )

    if (!response.ok) throw new Error(
      `Server answered with a HTTP response error: ${ response.status }, ${ response.statusText } }`
    )

    const buffer = await response.buffer()

    return buffer.toString('base64')

  } catch (error) {
    if (error instanceof AbortError) {
      throw new Error(`Request ${ filePath } was aborted or got a timeout`);
    } else {
      throw error
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get a duplex stream to a file on alfresco
 */
export const getFileStream = async (
  filePath: string,
  ticket: string,
  abortController: AbortController
) => {
  // see tests to get an example of this stream usage
  const filePathUrl = appendTicketToUrl(filePath, ticket)

  debug(`Getting a stream for '${filePathUrl}'`)

  return await fetch(
    filePathUrl,
    // @ts-ignore
    { signal: abortController.signal }
  )
}

/**
 * Upload a file and return the full path that finally fit.
 * File name can change from the provided one as it may already have one, so
 * we rename it to copy next to the already set one
 */
export const uploadPDF = async (
  { serverUrl }: AlfrescoInfo,
  studentInfo: StudentInfo,
  ticket: string,
  pdfFileName: string,
  pdfFile: Buffer
) => {
  const formData = new FormData()
  formData.append('cmisaction', 'createDocument')
  formData.append('propertyId[0]', 'cmis:objectTypeId')
  formData.append('propertyValue[0]', 'cmis:document')
  formData.append('propertyId[1]', 'cmis:name')
  formData.append('succinct', 'true')

  const pdfBlob = new File([pdfFile], pdfFileName)
  formData.append('file', pdfBlob)

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
      formData.append('propertyValue[1]', finalPdfFileName)
      const encoder = new FormDataEncoder(formData)

      debug(`Trying to deposit the file ${finalPdfFileName}`)

      // set a timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, alfrescoRequestTimeoutMS);

      try {
        // Post with fetch, oh yeah
        await fetch(
          fullPath,
          {
            headers: encoder.headers,
            method: 'POST',
            body: Readable.from(encoder.encode())
          }
        )
      } catch (error) {
        if (error instanceof AbortError) {
          throw new Error(`Request on ${ serverUrl } was aborted or got a timeout`);
        } else {
          throw error
        }
      } finally {
        clearTimeout(timeout);
      }

      let fullFinalUrl = fullPath
      fullFinalUrl.search = ''
      const fullFinalPath = fullFinalUrl + '/' + finalPdfFileName
      debug(`Successfully uploaded a file. Requested name : ${pdfFileName}. Final path : ${fullFinalPath}`)

      return fullFinalPath
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
