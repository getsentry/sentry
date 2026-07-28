import type {DocsFlow} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ProjectCreationVariant} from 'sentry/utils/analytics/projectCreationAnalyticsEvents';

/**
 * Maps a {@link DocsFlow} to the analytics event NAME for a setup-docs
 * interaction. Onboarding and SCM onboarding keep distinct event names. The two
 * project-creation arms (`project-creation`, `project-creation-scm`) resolve to
 * the SAME base `project_creation.*` name — SCM vs legacy is carried in a
 * `variant` param instead (see {@link docsFlowVariantParams}), so both variants
 * keep incrementing one counter. Several of these fire from more than one file,
 * so the taxonomy is centralized here to keep the names in sync.
 */
type DocsFlowEventMap<T extends string = string> = Record<DocsFlow, T>;

// Legacy default: the pre-enum `!newOrg && !hasScmOnboarding` arm. Peripheral
// surfaces that build DocsParams directly (e.g. updatedEmptyState) leave
// docsFlow undefined and must keep emitting these project-creation names.
const DEFAULT_FLOW: DocsFlow = 'project-creation';

export function resolveDocsFlowEvent<T extends string>(
  map: DocsFlowEventMap<T>,
  flow: DocsFlow | undefined
): T {
  return map[flow ?? DEFAULT_FLOW];
}

/**
 * Params to spread onto setup-docs events. Only an explicit project-creation
 * flow carries `variant`; unmarked/peripheral surfaces keep the canonical event
 * name without being guessed as legacy.
 */
export function docsFlowVariantParams(flow: DocsFlow | undefined): {
  variant?: ProjectCreationVariant;
} {
  switch (flow) {
    case 'project-creation-scm':
      return {variant: 'scm'};
    case 'project-creation':
      return {variant: 'legacy'};
    default:
      return {};
  }
}

/**
 * Project context for shared setup-docs events. Unmarked surfaces keep the
 * historical project-creation fallback, while onboarding events retain their
 * existing payload shape.
 */
export function docsFlowProjectIdParams(
  flow: DocsFlow | undefined,
  projectId: string
): {project_id?: string} {
  return flow === 'onboarding' || flow === 'onboarding-scm'
    ? {}
    : {project_id: projectId};
}

export const DSN_COPIED_EVENT = {
  onboarding: 'onboarding.dsn-copied',
  'onboarding-scm': 'onboarding.scm_dsn_copied',
  'project-creation': 'project_creation.dsn_copied',
  'project-creation-scm': 'project_creation.dsn_copied',
} as const satisfies DocsFlowEventMap;

export const NEXT_STEP_CLICKED_EVENT = {
  onboarding: 'onboarding.next_step_clicked',
  'onboarding-scm': 'onboarding.scm_next_step_clicked',
  'project-creation': 'project_creation.next_step_clicked',
  'project-creation-scm': 'project_creation.next_step_clicked',
} as const satisfies DocsFlowEventMap;

export const JS_LOADER_NPM_DOCS_SHOWN_EVENT = {
  onboarding: 'onboarding.js_loader_npm_docs_shown',
  'onboarding-scm': 'onboarding.scm_js_loader_npm_docs_shown',
  'project-creation': 'project_creation.js_loader_npm_docs_shown',
  'project-creation-scm': 'project_creation.js_loader_npm_docs_shown',
} as const satisfies DocsFlowEventMap;

export const SETUP_LOADER_DOCS_RENDERED_EVENT = {
  onboarding: 'onboarding.setup_loader_docs_rendered',
  'onboarding-scm': 'onboarding.scm_setup_loader_docs_rendered',
  'project-creation': 'project_creation.setup_loader_docs_rendered',
  'project-creation-scm': 'project_creation.setup_loader_docs_rendered',
} as const satisfies DocsFlowEventMap;

export const SOURCE_MAPS_COPY_CLICKED_EVENT = {
  onboarding: 'onboarding.source_maps_wizard_button_copy_clicked',
  'onboarding-scm': 'onboarding.scm_source_maps_wizard_button_copy_clicked',
  'project-creation': 'project_creation.source_maps_wizard_button_copy_clicked',
  'project-creation-scm': 'project_creation.source_maps_wizard_button_copy_clicked',
} as const satisfies DocsFlowEventMap;

export const SOURCE_MAPS_SELECTED_AND_COPIED_EVENT = {
  onboarding: 'onboarding.source_maps_wizard_selected_and_copied',
  'onboarding-scm': 'onboarding.scm_source_maps_wizard_selected_and_copied',
  'project-creation': 'project_creation.source_maps_wizard_selected_and_copied',
  'project-creation-scm': 'project_creation.source_maps_wizard_selected_and_copied',
} as const satisfies DocsFlowEventMap;

/**
 * Copy-as-markdown analytics params per flow. `source` names only the flow (no
 * `_scm` suffix); `variant` identifies the SCM or legacy experience. Unlike
 * {@link docsFlowVariantParams} (which is empty for onboarding, since
 * name-based onboarding events keep `onboarding.scm_*` names), this shared
 * cross-flow event needs the variant for the onboarding arms too, so it maps
 * all four flows.
 */
export function docsFlowMarkdownParams(flow: DocsFlow | undefined): {
  source: string;
  variant?: ProjectCreationVariant;
} {
  switch (flow) {
    case 'onboarding':
      return {source: 'first_time_setup', variant: 'legacy'};
    case 'onboarding-scm':
      return {source: 'first_time_setup', variant: 'scm'};
    case 'project-creation':
      return {source: 'project_getting_started', variant: 'legacy'};
    case 'project-creation-scm':
      return {source: 'project_getting_started', variant: 'scm'};
    default:
      return {source: 'project_getting_started'};
  }
}

/**
 * Gaming SDK-access modal `origin` per flow (Q1: no SCM split; collapse onto the
 * existing 2-value origin taxonomy). Fired from several gaming platform docs, so
 * the collapse lives here to stay consistent.
 */
export function docsFlowGamingOrigin(
  flow: DocsFlow | undefined
): 'onboarding' | 'project-creation' {
  return (flow ?? DEFAULT_FLOW) === 'onboarding' || flow === 'onboarding-scm'
    ? 'onboarding'
    : 'project-creation';
}
