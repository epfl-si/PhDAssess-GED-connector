import { URL } from "url";
export declare const alfrescoBaseURL: string | undefined;
export declare const fetchTicket: (alfrescoUsername: string, alfrescoPassword: string, alfrescoServerURL: string) => Promise<string>;
export declare const getStudentFolderURL: (studentName: string, sciper: string, doctoralID: string, ticket: string, alfrescoServerURL: string) => URL;
export declare const readFolder: (studentFolder: URL) => Promise<void>;
/**
 * Get a duplex stream to a file on alfresco
 * @param studentFolder
 * @param fileName
 */
export declare const getFileStream: (studentFolder: URL, fileName: string) => import("got", { with: { "resolution-mode": "import" } }).Request;
/**
 * Get a pdf file in a base64 format
 */
export declare const fetchFileAsBase64: (studentFolder: URL, fileName: string) => Promise<string>;
export declare const uploadPDF: (studentFolder: URL, pdfFileName: string, pdfFile: Buffer) => Promise<void>;
