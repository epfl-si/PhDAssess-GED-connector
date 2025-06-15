export declare const alfrescoBaseURL: string | undefined;
export type StudentInfo = {
    studentName: string;
    sciper: string;
    doctoralAcronym: string;
};
export declare const fetchTicket: (alfrescoUsername: string, alfrescoPassword: string, alfrescoServerURL: string) => Promise<string>;
export declare const getStudentFolderRelativeUrl: (studentInfo: StudentInfo) => string;
export declare const readFolder: (alfrescoBaseUrl: string, studentInfo: StudentInfo, ticket: string) => Promise<void>;
/**
 * Get a pdf file in a base64 format
 */
export declare const fetchFileAsBase64: (alfrescoBaseUrl: string, studentInfo: StudentInfo, ticket: string, fileName: string) => Promise<string>;
/**
 * Get a duplex stream to a file on alfresco
 */
export declare const getFileStream: (alfrescoBaseUrl: string, studentInfo: StudentInfo, ticket: string, fileName: string) => import("got", { with: { "resolution-mode": "import" } }).Request;
export declare const uploadPDF: (alfrescoBaseUrl: string, studentInfo: StudentInfo, ticket: string, pdfFileName: string, pdfFile: Buffer) => Promise<void>;
