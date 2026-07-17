import type {DocsFlow} from 'sentry/components/onboarding/gettingStartedDoc/types';

/**
 * Maps a {@link DocsFlow} to the analytics event name for a setup-docs
 * interaction. Every family maps all four flows to a distinct event so
 * onboarding, SCM onboarding, project creation, and SCM project creation can be
 * compared without a shared param dimension. The `dsn`/`sourceMaps` families are
 * fired from more than one file, so the taxonomy is centralized here to keep the
 * names in sync.
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

export const DSN_COPIED_EVENT = {
  onboarding: 'onboarding.dsn-copied',
  'onboarding-scm': 'onboarding.scm_dsn_copied',
  'project-creation': 'project_creation.dsn_copied',
  'project-creation-scm': 'project_creation.scm_dsn_copied',
} as const satisfies DocsFlowEventMap;

export const NEXT_STEP_CLICKED_EVENT = {
  onboarding: 'onboarding.next_step_clicked',
  'onboarding-scm': 'onboarding.scm_next_step_clicked',
  'project-creation': 'project_creation.next_step_clicked',
  'project-creation-scm': 'project_creation.scm_next_step_clicked',
} as const satisfies DocsFlowEventMap;

export const JS_LOADER_NPM_DOCS_SHOWN_EVENT = {
  onboarding: 'onboarding.js_loader_npm_docs_shown',
  'onboarding-scm': 'onboarding.scm_js_loader_npm_docs_shown',
  'project-creation': 'project_creation.js_loader_npm_docs_shown',
  'project-creation-scm': 'project_creation.scm_js_loader_npm_docs_shown',
} as const satisfies DocsFlowEventMap;

export const SETUP_LOADER_DOCS_RENDERED_EVENT = {
  onboarding: 'onboarding.setup_loader_docs_rendered',
  'onboarding-scm': 'onboarding.scm_setup_loader_docs_rendered',
  'project-creation': 'project_creation.setup_loader_docs_rendered',
  'project-creation-scm': 'project_creation.scm_setup_loader_docs_rendered',
} as const satisfies DocsFlowEventMap;

export const SOURCE_MAPS_COPY_CLICKED_EVENT = {
  onboarding: 'onboarding.source_maps_wizard_button_copy_clicked',
  'onboarding-scm': 'onboarding.scm_source_maps_wizard_button_copy_clicked',
  'project-creation': 'project_creation.source_maps_wizard_button_copy_clicked',
  'project-creation-scm': 'project_creation.scm_source_maps_wizard_button_copy_clicked',
} as const satisfies DocsFlowEventMap;

export const SOURCE_MAPS_SELECTED_AND_COPIED_EVENT = {
  onboarding: 'onboarding.source_maps_wizard_selected_and_copied',
  'onboarding-scm': 'onboarding.scm_source_maps_wizard_selected_and_copied',
  'project-creation': 'project_creation.source_maps_wizard_selected_and_copied',
  'project-creation-scm': 'project_creation.scm_source_maps_wizard_selected_and_copied',
} as const satisfies DocsFlowEventMap;

/**
 * Copy-as-markdown `source` value per flow (Q2: split by SCM).
 */
export const MARKDOWN_SOURCE_BY_FLOW: Record<DocsFlow, string> = {
  onboarding: 'first_time_setup',
  'onboarding-scm': 'first_time_setup_scm',
  'project-creation': 'project_getting_started',
  'project-creation-scm': 'project_getting_started_scm',
};

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
