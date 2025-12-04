export enum Steps {
  CONNECT_GITHUB = 'connect-github',
  SETUP_CODE_REVIEW = 'setup-code-review',
  SETUP_ROOT_CAUSE_ANALYSIS = 'setup-root-cause-analysis',
  NEXT_STEPS = 'next-steps',
}

export const STEPS_ORDER = [
  Steps.CONNECT_GITHUB,
  Steps.SETUP_CODE_REVIEW,
  Steps.SETUP_ROOT_CAUSE_ANALYSIS,
  Steps.NEXT_STEPS,
];
