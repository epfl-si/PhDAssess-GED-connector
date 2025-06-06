import type { PhDAssessVariables } from "phd-assess-meta/types/variables";
/**
 * GED has a specific way to name students folder.
 * This code try to find the good name from a task variables.
 */
export declare const buildStudentName: (jobVariables: PhDAssessVariables) => string;
