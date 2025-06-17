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
export declare const readFolder: ({ serverUrl }: AlfrescoInfo, studentInfo: StudentInfo, ticket: string) => Promise<void>;
/**
 * Get a pdf file in a base64 format
 */
export declare const fetchFileAsBase64: ({ serverUrl }: AlfrescoInfo, studentInfo: StudentInfo, ticket: string, fileName: string) => Promise<string>;
/**
 * Get a duplex stream to a file on alfresco
 */
export declare const getFileStream: ({ serverUrl }: AlfrescoInfo, studentInfo: StudentInfo, ticket: string, fileName: string) => import("got", { with: { "resolution-mode": "import" } }).Request;
/**
 * Upload a file and return the name that finally fit.
 * Name can change from the provided one as it may already have one, so
 * we rename it to copy next to the already set one
 */
export declare const uploadPDF: ({ serverUrl }: AlfrescoInfo, studentInfo: StudentInfo, ticket: string, pdfFileName: string, pdfFile: Buffer) => Promise<string | undefined>;
