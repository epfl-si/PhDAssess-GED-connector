import type {PhDAssessVariables} from "phd-assess-meta/types/variables";

/**
 * GED has a specific way to name students folder.
 * This code tries to find the good name from the task variables.
 */
export const buildStudentName = (jobVariables: PhDAssessVariables) => {
  if (jobVariables.phdStudentFirstName && jobVariables.phdStudentLastName) {
    return `${jobVariables.phdStudentLastName}, ${jobVariables.phdStudentFirstName}`
  } else {
    return jobVariables.phdStudentName ?? ''
  }
}
