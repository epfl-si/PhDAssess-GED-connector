import fetch from 'node-fetch';
import { AbortController } from "node-abort-controller";
import { AlfrescoInfo, StudentInfo } from './types';
export declare const fetchTicket: ({ serverUrl, username, password }: AlfrescoInfo) => Promise<string>;
export declare const getStudentFolderRelativeUrl: (studentInfo: StudentInfo) => string;
/**
 * Get info about a folder based on the provided student info
 *
 * @param alfrescoBaseUrl
 * @param studentInfo
 * @param ticket
 */
export declare const readFolder: ({ serverUrl }: AlfrescoInfo, studentInfo: StudentInfo, ticket: string) => Promise<JSON>;
/**
 * Check if a file name already exists
 */
export declare const fileNameExists: (fileNameToFind: string, studentFolderJsonInfo: any) => boolean;
/**
 * Get a pdf file in a base64 format
 */
export declare const fetchFileAsBase64: (filePath: string, ticket: string) => Promise<string>;
/**
 * Get a duplex stream to a file on alfresco
 */
export declare const getFileStream: (filePath: string, ticket: string, abortController: AbortController) => Promise<fetch.Response>;
/**
 * Upload a file and return the full path that finally fit.
 * File name can change from the provided one as it may already have one, so
 * we rename it to copy next to the already set one
 */
export declare const uploadPDF: (alfrescoInfo: AlfrescoInfo, studentInfo: StudentInfo, ticket: string, pdfFileName: string, pdfFile: Buffer) => Promise<string>;
