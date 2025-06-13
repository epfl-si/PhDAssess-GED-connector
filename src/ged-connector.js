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
exports.uploadPDF = exports.fetchFileAsBase64 = exports.getFileStream = exports.readFolder = exports.getStudentFolderURL = exports.fetchTicket = exports.alfrescoBaseURL = void 0;
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
const getStudentFolderURL = (studentName, sciper, doctoralID, ticket, alfrescoServerURL) => {
    const studentFolderName = `${studentName}, ${sciper}`;
    const doctoratName = _.find(doctorats_1.ecolesDoctorales, { id: doctoralID })?.label ?? doctoralID;
    const StudentsFolderURL = new url_1.URL(`/alfresco/api/-default-/public/cmis/versions/1.1/browser/root/Etudiants/Dossiers%20Etudiants/${encodeURIComponent(studentFolderName)}/${encodeURIComponent(doctoratName)}/Cursus`, alfrescoServerURL);
    StudentsFolderURL.search = `alf_ticket=${ticket}&format=json`;
    debug(`Using student folder with url ${StudentsFolderURL}`);
    return StudentsFolderURL;
};
exports.getStudentFolderURL = getStudentFolderURL;
const readFolder = async (studentFolder) => {
    const studentFolderInfo = await got_1.default.get(studentFolder, {}).json();
    debug(`Fetched ${JSON.stringify(studentFolderInfo, null, 2)}`);
};
exports.readFolder = readFolder;
/**
 * Get a duplex stream to a file on alfresco
 * @param studentFolder
 * @param fileName
 */
const getFileStream = (studentFolder, fileName) => {
    // see tests to get an example of this stream usage
    // reconstruct the url to add the filename
    const urlParameters = studentFolder.searchParams;
    const fullPath = new url_1.URL('Cursus/' + fileName + '?' + urlParameters, studentFolder);
    debug(`Getting a stream for '${fullPath}'`);
    return got_1.default.stream(fullPath, {});
};
exports.getFileStream = getFileStream;
/**
 * Get a pdf file in a base64 format
 */
const fetchFileAsBase64 = async (studentFolder, fileName) => {
    // reconstruct the url to add the filename
    const urlParameters = studentFolder.searchParams;
    const fullPath = new url_1.URL('Cursus/' + fileName + '?' + urlParameters, studentFolder);
    debug(`Getting file '${fullPath}' to save as buffer`);
    const response = await (0, got_1.default)(fullPath, {
        responseType: 'buffer'
    });
    return response.body.toString('base64');
};
exports.fetchFileAsBase64 = fetchFileAsBase64;
const uploadPDF = async (studentFolder, pdfFileName, pdfFile) => {
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
    await got_1.default.post(studentFolder, {
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
