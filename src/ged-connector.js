"use strict";
// set timeout and retry values
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPDF = exports.downloadFile = exports.readFolder = exports.getStudentFolderURL = exports.fetchTicket = exports.alfrescoBaseURL = void 0;
var debug_1 = require("debug");
var lodash_1 = require("lodash");
var got_1 = require("got");
var stream_1 = require("stream");
var url_1 = require("url");
var formdata_node_1 = require("formdata-node");
var form_data_encoder_1 = require("form-data-encoder");
var doctorats_1 = require("./doctorats");
var fs = require("node:fs");
var debug = (0, debug_1.default)('ged-connector');
exports.alfrescoBaseURL = process.env.ALFRESCO_URL;
var alfrescoLoginUrl = new url_1.URL("/alfresco/service/api/login", exports.alfrescoBaseURL);
var alfrescoRequestTimeoutMS = 40000; // 40 seconds
var fetchTicket = function () { return __awaiter(void 0, void 0, void 0, function () {
    var dataTicket;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(process.env.ALFRESCO_USERNAME && process.env.ALFRESCO_PASSWORD)) return [3 /*break*/, 2];
                alfrescoLoginUrl.search = "u=".concat(process.env.ALFRESCO_USERNAME, "&pw=").concat(process.env.ALFRESCO_PASSWORD, "&format=json");
                return [4 /*yield*/, got_1.default.get(alfrescoLoginUrl, {
                        timeout: {
                            request: alfrescoRequestTimeoutMS
                        },
                        retry: {
                            limit: 0
                        },
                    }).json()];
            case 1:
                dataTicket = _a.sent();
                debug("Asked for the alfresco ticket and got ".concat(JSON.stringify(dataTicket)));
                if (!dataTicket.data.ticket)
                    throw new Error("Alresco answered but did not give any ticket. Returned data : ".concat(JSON.stringify(dataTicket)));
                return [2 /*return*/, dataTicket.data.ticket];
            case 2: throw new Error("Missing environment variables to ALFRESCO_USERNAME and/or ALFRESCO_PASSWORD");
        }
    });
}); };
exports.fetchTicket = fetchTicket;
var getStudentFolderURL = function (studentName, sciper, doctoralID, ticket) { return __awaiter(void 0, void 0, void 0, function () {
    var studentFolderName, doctoratName, StudentsFolderURL;
    var _a, _b;
    return __generator(this, function (_c) {
        studentFolderName = "".concat(studentName, ", ").concat(sciper);
        doctoratName = (_b = (_a = lodash_1.default.find(doctorats_1.ecolesDoctorales, { id: doctoralID })) === null || _a === void 0 ? void 0 : _a.label) !== null && _b !== void 0 ? _b : doctoralID;
        StudentsFolderURL = new url_1.URL("/alfresco/api/-default-/public/cmis/versions/1.1/browser/root/Etudiants/Dossiers%20Etudiants/".concat(encodeURIComponent(studentFolderName), "/").concat(encodeURIComponent(doctoratName), "/Cursus"), exports.alfrescoBaseURL);
        StudentsFolderURL.search = "alf_ticket=".concat(ticket, "&format=json");
        debug("Using student folder with url ".concat(StudentsFolderURL));
        return [2 /*return*/, StudentsFolderURL];
    });
}); };
exports.getStudentFolderURL = getStudentFolderURL;
var readFolder = function (studentFolder) { return __awaiter(void 0, void 0, void 0, function () {
    var studentFolderInfo;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, got_1.default.get(studentFolder, {}).json()];
            case 1:
                studentFolderInfo = _a.sent();
                debug("Fetched ".concat(JSON.stringify(studentFolderInfo, null, 2)));
                return [2 /*return*/];
        }
    });
}); };
exports.readFolder = readFolder;
var downloadFile = function (studentFolder, fileName, destinationPath) { return __awaiter(void 0, void 0, void 0, function () {
    var urlParameters, fullPath;
    return __generator(this, function (_a) {
        urlParameters = studentFolder.searchParams;
        fullPath = new url_1.URL('Cursus/' + fileName + '?' + urlParameters, studentFolder);
        debug("Getting file '".concat(fullPath, "' to save locally"));
        got_1.default.stream(fullPath, {}).pipe(fs.createWriteStream(destinationPath));
        debug("File fetched to ".concat(destinationPath));
        return [2 /*return*/];
    });
}); };
exports.downloadFile = downloadFile;
var uploadPDF = function (studentFolder, pdfFileName, pdfFile) { return __awaiter(void 0, void 0, void 0, function () {
    var form, pdfBlob, encoder;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                form = new formdata_node_1.FormData();
                form.set('cmisaction', 'createDocument');
                form.set('propertyId[0]', 'cmis:objectTypeId');
                form.set('propertyValue[0]', 'cmis:document');
                form.set('propertyId[1]', 'cmis:name');
                form.set('propertyValue[1]', pdfFileName);
                form.set('succinct', 'true');
                pdfBlob = new formdata_node_1.File([pdfFile], pdfFileName);
                form.set('file', pdfBlob);
                encoder = new form_data_encoder_1.FormDataEncoder(form);
                return [4 /*yield*/, got_1.default.post(studentFolder, {
                        body: stream_1.Readable.from(encoder.encode()),
                        headers: encoder.headers,
                        timeout: {
                            request: alfrescoRequestTimeoutMS
                        },
                        retry: {
                            limit: 0
                        },
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.uploadPDF = uploadPDF;
