export enum Steps {
  CONNECT_GITHUB = 1,
  SETUP_CODE_REVIEW = 2,
  SETUP_ROOT_CAUSE_ANALYSIS = 3,
  SETUP_DEFAULTS = 4,
  WRAP_UP = 5,
}

export function initialStepToName(step: Steps): string {
  switch (step) {
    case Steps.CONNECT_GITHUB:
      return 'connect_github';
    case Steps.SETUP_CODE_REVIEW:
      return 'setup_code_review';
    case Steps.SETUP_ROOT_CAUSE_ANALYSIS:
      return 'setup_root_cause_analysis';
    case Steps.SETUP_DEFAULTS:
      return 'setup_defaults';
    case Steps.WRAP_UP:
      return 'wrap_up';
    default:
      return 'unknown';
  }
}
