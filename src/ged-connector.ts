// set timeout and retry values

import debug_ from 'debug'
import * as _ from "lodash";
import {URL} from "url";
import {Readable} from "stream"
import {FormData, File} from 'formdata-node';

// @ts-ignore
import {FormDataEncoder} from "form-data-encoder";

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

  } catch (error: any) {
    if (error.name === 'AbortError') {
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

    return studentFolderJsonInfo
  } catch(error: any) {
    if (error.name === 'AbortError') {
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
 * Check if a file name already exists
 */
export const fileNameExists = (
  fileNameToFind: string,
  studentFolderJsonInfo: any,  // it is some CMIS struct, in fact
) => {
  return _.find(
    studentFolderJsonInfo.objects,
    { object: { properties: { 'cmis:name': { value: fileNameToFind } } } }
  ) !== undefined
}

/**
 * Get a PDF file in a base64 format
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

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return buffer.toString('base64')

  } catch (error: any) {
    if (error.name === 'AbortError') {
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
 * The File name can change from the provided one as it may already have one, so
 * we rename it to copy next to the already set one
 */
export const uploadPDF = async (
  alfrescoInfo: AlfrescoInfo,
  studentInfo: StudentInfo,
  ticket: string,
  pdfFileName: string,
  pdfFile: Buffer
) => {
  // let's validate a good name first
  const folderCmisObjects = await readFolder(
    alfrescoInfo,
    studentInfo,
    ticket
  ) as any

  const fullPath = buildAlfrescoFullUrl(
    alfrescoInfo.serverUrl,
    studentInfo,
    ticket
  )

  const maxRetry = 99
  let attempt = 0
  let finalPdfFileName = pdfFileName

  while (attempt < maxRetry) {
    if (
      fileNameExists(finalPdfFileName, folderCmisObjects)
    ) {
      // this name is not free, build a new one
      attempt++

      finalPdfFileName = finalPdfFileName.match(/_v(\d+)(\.[^.]*)$/)
        ? finalPdfFileName.replace(/_v(\d+)(\.[^.]*)$/, (_, v, ext) => `_v${+v + 1}${ext}`)
        : finalPdfFileName.replace(/(\.[^.]*)$/, "_v1$1");
    } else {
      // ok, the name should be good, let's upload the file

      const formData = new FormData()
      formData.append('cmisaction', 'createDocument')
      formData.append('propertyId[0]', 'cmis:objectTypeId')
      formData.append('propertyValue[0]', 'cmis:document')
      formData.append('propertyId[1]', 'cmis:name')
      formData.append('succinct', 'true')

      const pdfBlob = new File([pdfFile], finalPdfFileName)
      formData.append('file', pdfBlob)
      formData.append('propertyValue[1]', finalPdfFileName)
      const encoder = new FormDataEncoder(formData)

      debug(`Trying to deposit the file ${ finalPdfFileName }`)

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
            body: Readable.from(encoder.encode()) as unknown as BodyInit,
            duplex: 'half'
          } as any
        )
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error(`Request on ${ alfrescoInfo.serverUrl } was aborted or got a timeout`);
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
    }
  }

  // all attempts have failed
  throw new Error(`Unable to find a free name for the document`)
}
