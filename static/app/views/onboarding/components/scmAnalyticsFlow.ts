/**
 * Which flow is hosting the SCM step components. Used to pick which
 * `*.scm_*` analytics event names the components fire (onboarding for
 * new-org onboarding, project-creation for the project creation wizard).
 */
export type ScmAnalyticsFlow = 'onboarding' | 'project-creation';
