"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStudentName = void 0;
/**
 * GED has a specific way to name students folder.
 * This code tries to find the good name from the task variables.
 */
const buildStudentName = (jobVariables) => {
    if (jobVariables.phdStudentFirstName && jobVariables.phdStudentLastName) {
        return `${jobVariables.phdStudentLastName}, ${jobVariables.phdStudentFirstName}`;
    }
    else {
        return jobVariables.phdStudentName ?? '';
    }
};
exports.buildStudentName = buildStudentName;
