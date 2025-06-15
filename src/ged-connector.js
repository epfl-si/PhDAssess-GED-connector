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
exports.uploadPDF = exports.getFileStream = exports.fetchFileAsBase64 = exports.readFolder = exports.getStudentFolderRelativeUrl = exports.fetchTicket = exports.alfrescoBaseURL = void 0;
const debug_1 = __importDefault(require("debug"));
const _ = __importStar(require("lodash"));
const got_1 = __importDefault(require("got"));
const stream_1 = require("stream");
const url_1 = require("url");
const formdata_node_1 = require("formdata-node");
// @ts-ignore
const form_data_encoder_1 = require("form-data-encoder");
const doctorats_1 = require("./doctorats");
const debug = (0, debug_1.default)('ged-connector');
exports.alfrescoBaseURL = process.env.ALFRESCO_URL;
const alfrescoRequestTimeoutMS = 40000; // 40 seconds
const fetchTicket = async (alfrescoUsername, alfrescoPassword, alfrescoServerURL) => {
    debug(`Using server ${alfrescoServerURL}`);
    if (alfrescoUsername && alfrescoPassword) {
        const alfrescoLoginUrl = new url_1.URL(`/alfresco/service/api/login`, alfrescoServerURL);
        alfrescoLoginUrl.search = `u=${alfrescoUsername}&pw=${alfrescoPassword}&format=json`;
        const dataTicket = await got_1.default.get(alfrescoLoginUrl, {
            timeout: {
                request: alfrescoRequestTimeoutMS
            },
            retry: {
                limit: 0
            },
        }).json();
        debug(`Asked for the alfresco ticket and got ${JSON.stringify(dataTicket)}`);
        if (!dataTicket.data.ticket)
            throw new Error(`Alresco answered but did not give any ticket. Returned data : ${JSON.stringify(dataTicket)}`);
        return dataTicket.data.ticket;
    }
    else {
        throw new Error(`Missing environment variables to ALFRESCO_USERNAME and/or ALFRESCO_PASSWORD`);
    }
};
exports.fetchTicket = fetchTicket;
const getStudentFolderRelativeUrl = (studentInfo) => {
    const studentFolderName = `${studentInfo.studentName}, ${studentInfo.sciper}`;
    const doctoratName = _.find(doctorats_1.ecolesDoctorales, { id: studentInfo.doctoralAcronym })?.label ?? studentInfo.doctoralAcronym;
    const studentsFolderURL = `/alfresco/api/-default-/public/cmis/versions/1.1/browser/root/Etudiants/Dossiers%20Etudiants/${encodeURIComponent(studentFolderName)}/${encodeURIComponent(doctoratName)}/Cursus`;
    return studentsFolderURL;
};
exports.getStudentFolderRelativeUrl = getStudentFolderRelativeUrl;
/**
 * Get the full path to the student folder.
 * Set the fileName parameter if you need to get a path to a file
 */
const buildAlfrescoFullUrl = (alfrescoBaseUrl, studentInfo, ticket, fileName = '') => {
    let studentPath = new url_1.URL((0, exports.getStudentFolderRelativeUrl)(studentInfo), alfrescoBaseUrl);
    if (fileName)
        studentPath.pathname += `/${fileName}`;
    // add auth and format parameter
    studentPath.searchParams.set('alf_ticket', ticket);
    studentPath.searchParams.set('format', 'json');
    return studentPath;
};
const readFolder = async (alfrescoBaseUrl, studentInfo, ticket) => {
    const folderFullPath = buildAlfrescoFullUrl(alfrescoBaseUrl, studentInfo, ticket);
    debug(`Reading student folder info ${folderFullPath}`);
    const studentFolderJsonInfo = await got_1.default.get(folderFullPath, {}).json();
    if (studentFolderJsonInfo && Object.keys(studentFolderJsonInfo).length) {
        debug(`Successfully accessed the student folder`);
    }
    else {
        debug(`Fetched a student folder but empty`);
    }
};
exports.readFolder = readFolder;
/**
 * Get a pdf file in a base64 format
 */
const fetchFileAsBase64 = async (alfrescoBaseUrl, studentInfo, ticket, fileName) => {
    const fullPath = buildAlfrescoFullUrl(alfrescoBaseUrl, studentInfo, ticket, fileName);
    debug(`Getting file '${fullPath}' to save as buffer`);
    const response = await (0, got_1.default)(fullPath, {
        responseType: 'buffer'
    });
    return response.body.toString('base64');
};
exports.fetchFileAsBase64 = fetchFileAsBase64;
/**
 * Get a duplex stream to a file on alfresco
 */
const getFileStream = (alfrescoBaseUrl, studentInfo, ticket, fileName) => {
    // see tests to get an example of this stream usage
    const fullPath = buildAlfrescoFullUrl(alfrescoBaseUrl, studentInfo, ticket, fileName);
    debug(`Getting a stream for '${fullPath}'`);
    return got_1.default.stream(fullPath, {});
};
exports.getFileStream = getFileStream;
const uploadPDF = async (alfrescoBaseUrl, studentInfo, ticket, pdfFileName, pdfFile) => {
    const form = new formdata_node_1.FormData();
    form.set('cmisaction', 'createDocument');
    form.set('propertyId[0]', 'cmis:objectTypeId');
    form.set('propertyValue[0]', 'cmis:document');
    form.set('propertyId[1]', 'cmis:name');
    form.set('propertyValue[1]', pdfFileName);
    form.set('succinct', 'true');
    const pdfBlob = new formdata_node_1.File([pdfFile], pdfFileName);
    form.set('file', pdfBlob);
    const encoder = new form_data_encoder_1.FormDataEncoder(form);
    const fullPath = buildAlfrescoFullUrl(alfrescoBaseUrl, studentInfo, ticket);
    await got_1.default.post(fullPath, {
        body: stream_1.Readable.from(encoder.encode()),
        headers: encoder.headers,
        timeout: {
            request: alfrescoRequestTimeoutMS
        },
        retry: {
            limit: 0
        },
    });
};
exports.uploadPDF = uploadPDF;
