import type {ProjectCreationVariant} from 'sentry/utils/analytics/projectCreationAnalyticsEvents';

/**
 * Which flow is hosting the SCM step components. Used to pick which
 * `*.scm_*` analytics event names the components fire (onboarding for
 * new-org onboarding, project-creation for the project creation wizard).
 */
export type ScmAnalyticsFlow = 'onboarding' | 'project-creation';

/**
 * Params to spread onto a project-creation analytics event so the SCM vs legacy
 * variant rides in a `variant` param instead of a distinct `scm_` event name
 * (VDY-133). Returns `{}` for the onboarding flow — those events keep their
 * distinct `onboarding.scm_*` names and must NOT carry a project-creation
 * `variant`. The SCM cores only ever run in the SCM variant of project
 * creation, so the `project-creation` flow always maps to `variant: 'scm'`.
 */
export function scmFlowVariantParams(flow: ScmAnalyticsFlow): {
  variant?: ProjectCreationVariant;
} {
  return flow === 'project-creation' ? {variant: 'scm'} : {};
}
