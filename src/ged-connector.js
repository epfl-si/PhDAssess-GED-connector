"use strict";
// set timeout and retry values
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPDF = exports.getFileStream = exports.fetchFileAsBase64 = exports.readFolder = exports.getStudentFolderRelativeUrl = exports.fetchTicket = void 0;
const debug_1 = __importDefault(require("debug"));
const _ = __importStar(require("lodash"));
const url_1 = require("url");
const stream_1 = require("stream");
const node_fetch_1 = __importStar(require("node-fetch"));
const formdata_node_1 = require("formdata-node");
// @ts-ignore
const form_data_encoder_1 = require("form-data-encoder");
const doctorats_1 = require("./doctorats");
const debug = (0, debug_1.default)('ged-connector');
const alfrescoRequestTimeoutMS = 40000; // 40 seconds
const appendTicketToUrl = (url, ticket) => {
    if (!(url instanceof url_1.URL)) {
        url = new url_1.URL(url);
    }
    url.searchParams.set('alf_ticket', ticket);
    return url;
};
const fetchTicket = async ({ serverUrl, username, password }) => {
    debug(`Using server ${serverUrl}`);
    if (!username || !password)
        throw new Error(`Missing username or password to connect to the remote server`);
    const alfrescoLoginUrl = new url_1.URL(`/alfresco/service/api/login`, serverUrl);
    alfrescoLoginUrl.search = `u=${username}&pw=${password}&format=json`;
    // set a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, alfrescoRequestTimeoutMS);
    try {
        const response = await (0, node_fetch_1.default)(alfrescoLoginUrl, { signal: controller.signal });
        if (!response.ok)
            throw new Error(`Alfresco answered with a response error. Returned error: ${response}`);
        const dataTicket = await response.json();
        debug(`Asked for the alfresco ticket and got ${JSON.stringify(dataTicket)}`);
        if (!dataTicket.data.ticket)
            throw new Error(`Alfresco answered but did not give any ticket. Returned data : ${JSON.stringify(dataTicket)}`);
        return dataTicket.data.ticket;
    }
    catch (error) {
        if (error instanceof node_fetch_1.AbortError) {
            throw new Error(`Request on ${serverUrl} was aborted or got a timeout`);
        }
        else {
            throw error;
        }
    }
    finally {
        clearTimeout(timeout);
    }
};
exports.fetchTicket = fetchTicket;
const getStudentFolderRelativeUrl = (studentInfo) => {
    const studentFolderName = `${studentInfo.studentName}, ${studentInfo.sciper}`;
    const doctoratName = _.find(doctorats_1.ecolesDoctorales, { id: studentInfo.doctoralAcronym })?.label ?? studentInfo.doctoralAcronym;
    return `/alfresco/api/-default-/public/cmis/versions/1.1/browser/root/` +
        `Etudiants/Dossiers%20Etudiants/${encodeURIComponent(studentFolderName)}/${encodeURIComponent(doctoratName)}/Cursus`;
};
exports.getStudentFolderRelativeUrl = getStudentFolderRelativeUrl;
/**
 * Get the full path to the student folder.
 * Set the fileName parameter if you need to get a path to a file
 */
const buildAlfrescoFullUrl = (serverUrl, studentInfo, ticket, fileName = '') => {
    let studentPath = new url_1.URL((0, exports.getStudentFolderRelativeUrl)(studentInfo), serverUrl);
    if (fileName)
        studentPath.pathname += `/${fileName}`;
    // add auth and format parameter
    studentPath.searchParams.set('alf_ticket', ticket);
    studentPath.searchParams.set('format', 'json');
    return studentPath;
};
/**
 * Get info about a folder based on the provided student info
 *
 * @param alfrescoBaseUrl
 * @param studentInfo
 * @param ticket
 */
const readFolder = async ({ serverUrl }, studentInfo, ticket) => {
    const folderFullPath = buildAlfrescoFullUrl(serverUrl, studentInfo, ticket);
    // set a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, alfrescoRequestTimeoutMS);
    debug(`Reading student folder info ${folderFullPath}`);
    try {
        const response = await (0, node_fetch_1.default)(folderFullPath, { signal: controller.signal });
        if (!response.ok)
            throw new Error(`${serverUrl} answered with a HTTP response error: ${response.status}, ${response.statusText} }`);
        const studentFolderJsonInfo = await response.json();
        if (studentFolderJsonInfo && Object.keys(studentFolderJsonInfo).length) {
            debug(`Successfully accessed the student folder`);
        }
        else {
            debug(`Fetched a student folder but empty ${studentFolderJsonInfo}`);
        }
    }
    catch (error) {
        if (error instanceof node_fetch_1.AbortError) {
            throw new Error('request was aborted or got a timeout');
        }
        else if (error.response?.statusCode) {
            error.message += `. URL used: ${folderFullPath}`;
            throw error;
        }
        else {
            throw error;
        }
    }
    finally {
        clearTimeout(timeout);
    }
};
exports.readFolder = readFolder;
/**
 * Get a pdf file in a base64 format
 */
const fetchFileAsBase64 = async (filePath, ticket) => {
    const filePathUrl = appendTicketToUrl(filePath, ticket);
    debug(`Getting file '${filePathUrl}' to save as buffer`);
    // set a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, alfrescoRequestTimeoutMS);
    try {
        const response = await (0, node_fetch_1.default)(filePathUrl, { signal: controller.signal });
        if (!response.ok)
            throw new Error(`Server answered with a HTTP response error: ${response.status}, ${response.statusText} }`);
        const buffer = await response.buffer();
        return buffer.toString('base64');
    }
    catch (error) {
        if (error instanceof node_fetch_1.AbortError) {
            throw new Error(`Request ${filePath} was aborted or got a timeout`);
        }
        else {
            throw error;
        }
    }
    finally {
        clearTimeout(timeout);
    }
};
exports.fetchFileAsBase64 = fetchFileAsBase64;
/**
 * Get a duplex stream to a file on alfresco
 */
const getFileStream = async (filePath, ticket, abortController) => {
    // see tests to get an example of this stream usage
    const filePathUrl = appendTicketToUrl(filePath, ticket);
    debug(`Getting a stream for '${filePathUrl}'`);
    return await (0, node_fetch_1.default)(filePathUrl, { signal: abortController.signal });
};
exports.getFileStream = getFileStream;
/**
 * Upload a file and return the full path that finally fit.
 * File name can change from the provided one as it may already have one, so
 * we rename it to copy next to the already set one
 */
const uploadPDF = async ({ serverUrl }, studentInfo, ticket, pdfFileName, pdfFile) => {
    const formData = new formdata_node_1.FormData();
    formData.append('cmisaction', 'createDocument');
    formData.append('propertyId[0]', 'cmis:objectTypeId');
    formData.append('propertyValue[0]', 'cmis:document');
    formData.append('propertyId[1]', 'cmis:name');
    formData.append('succinct', 'true');
    const pdfBlob = new formdata_node_1.File([pdfFile], pdfFileName);
    formData.append('file', pdfBlob);
    const fullPath = buildAlfrescoFullUrl(serverUrl, studentInfo, ticket);
    // we may need to change the filename
    let finalPdfFileName = pdfFileName;
    const maxRetry = 50;
    let attempt = 0;
    while (attempt < maxRetry) {
        try {
            formData.append('propertyValue[1]', finalPdfFileName);
            const encoder = new form_data_encoder_1.FormDataEncoder(formData);
            debug(`Trying to deposit the file ${finalPdfFileName}`);
            // set a timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => {
                controller.abort();
            }, alfrescoRequestTimeoutMS);
            try {
                // Post with fetch, oh yeah
                await (0, node_fetch_1.default)(fullPath, {
                    headers: encoder.headers,
                    method: 'POST',
                    body: stream_1.Readable.from(encoder.encode())
                });
            }
            catch (error) {
                if (error instanceof node_fetch_1.AbortError) {
                    throw new Error(`Request on ${serverUrl} was aborted or got a timeout`);
                }
                else {
                    throw error;
                }
            }
            finally {
                clearTimeout(timeout);
            }
            let fullFinalUrl = fullPath;
            fullFinalUrl.search = '';
            const fullFinalPath = fullFinalUrl + '/' + finalPdfFileName;
            debug(`Successfully uploaded a file. Requested name : ${pdfFileName}. Final path : ${fullFinalPath}`);
            return fullFinalPath;
        }
        catch (error) {
            if (error.response?.statusCode === 409) {
                // retry with a different name
                debug(`The File name conflict. Retrying`);
                // the regex allows to capture the filename extension (.pdf)
                attempt++;
                // add the _v1, or increment
                finalPdfFileName = finalPdfFileName.match(/_v(\d+)(\.[^.]*)$/)
                    ? finalPdfFileName.replace(/_v(\d+)(\.[^.]*)$/, (_, v, ext) => `_v${+v + 1}${ext}`)
                    : finalPdfFileName.replace(/(\.[^.]*)$/, "_v1$1");
            }
            else {
                throw error; // Rethrow or handle other errors as needed
            }
        }
    }
};
exports.uploadPDF = uploadPDF;
