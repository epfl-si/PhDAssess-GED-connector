import { URL } from "url";
export declare const alfrescoBaseURL: string | undefined;
export declare const fetchTicket: (alfrescoUsername: string, alfrescoPassword: string, alfrescoServerURL: string) => Promise<string>;
export declare const getStudentFolderURL: (studentName: string, sciper: string, doctoralID: string, ticket: string, alfrescoServerURL: string) => URL;
export declare const readFolder: (studentFolder: URL) => Promise<void>;
export declare const downloadFile: (studentFolder: URL, fileName: string, destinationPath: string) => Promise<void>;
export declare const uploadPDF: (studentFolder: URL, pdfFileName: string, pdfFile: Buffer) => Promise<void>;
