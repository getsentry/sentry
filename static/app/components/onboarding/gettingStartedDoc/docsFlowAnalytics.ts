import type {DocsFlow} from 'sentry/components/onboarding/gettingStartedDoc/types';

/**
 * Maps {@link DocsFlow} onto the existing analytics taxonomy without changing
 * behavior. The pre-refactor boolean branches did not all share a fallback:
 * DSN/next-step/loader events treated every non-SCM surface as onboarding,
 * while source-map events had an explicit project-creation arm. Each map keeps
 * its own `default` so callers that never supplied either boolean retain that
 * exact behavior.
 */
type DocsFlowEventMap<T extends string = string> = Record<DocsFlow | 'default', T>;

export function resolveDocsFlowEvent<T extends string>(
  map: DocsFlowEventMap<T>,
  flow: DocsFlow | undefined
): T {
  return map[flow ?? 'default'];
}

export const DSN_COPIED_EVENT = {
  onboarding: 'onboarding.dsn-copied',
  'onboarding-scm': 'onboarding.scm_dsn_copied',
  'project-creation': 'onboarding.dsn-copied',
  'project-creation-scm': 'onboarding.dsn-copied',
  default: 'onboarding.dsn-copied',
} as const satisfies DocsFlowEventMap;

export const NEXT_STEP_CLICKED_EVENT = {
  onboarding: 'onboarding.next_step_clicked',
  'onboarding-scm': 'onboarding.scm_next_step_clicked',
  'project-creation': 'onboarding.next_step_clicked',
  'project-creation-scm': 'onboarding.next_step_clicked',
  default: 'onboarding.next_step_clicked',
} as const satisfies DocsFlowEventMap;

export const JS_LOADER_NPM_DOCS_SHOWN_EVENT = {
  onboarding: 'onboarding.js_loader_npm_docs_shown',
  'onboarding-scm': 'onboarding.scm_js_loader_npm_docs_shown',
  'project-creation': 'onboarding.js_loader_npm_docs_shown',
  'project-creation-scm': 'onboarding.js_loader_npm_docs_shown',
  default: 'onboarding.js_loader_npm_docs_shown',
} as const satisfies DocsFlowEventMap;

export const SETUP_LOADER_DOCS_RENDERED_EVENT = {
  onboarding: 'onboarding.setup_loader_docs_rendered',
  'onboarding-scm': 'onboarding.scm_setup_loader_docs_rendered',
  'project-creation': 'onboarding.setup_loader_docs_rendered',
  'project-creation-scm': 'onboarding.setup_loader_docs_rendered',
  default: 'onboarding.setup_loader_docs_rendered',
} as const satisfies DocsFlowEventMap;

export const SOURCE_MAPS_COPY_CLICKED_EVENT = {
  onboarding: 'onboarding.source_maps_wizard_button_copy_clicked',
  'onboarding-scm': 'onboarding.scm_source_maps_wizard_button_copy_clicked',
  'project-creation': 'project_creation.source_maps_wizard_button_copy_clicked',
  'project-creation-scm': 'project_creation.source_maps_wizard_button_copy_clicked',
  default: 'project_creation.source_maps_wizard_button_copy_clicked',
} as const satisfies DocsFlowEventMap;

export const SOURCE_MAPS_SELECTED_AND_COPIED_EVENT = {
  onboarding: 'onboarding.source_maps_wizard_selected_and_copied',
  'onboarding-scm': 'onboarding.scm_source_maps_wizard_selected_and_copied',
  'project-creation': 'project_creation.source_maps_wizard_selected_and_copied',
  'project-creation-scm': 'project_creation.source_maps_wizard_selected_and_copied',
  default: 'project_creation.source_maps_wizard_selected_and_copied',
} as const satisfies DocsFlowEventMap;

/** Copy-as-markdown `source` value, preserving the old `newOrg` split. */
export const MARKDOWN_SOURCE_BY_FLOW: Record<DocsFlow, string> = {
  onboarding: 'first_time_setup',
  'onboarding-scm': 'first_time_setup',
  'project-creation': 'project_getting_started',
  'project-creation-scm': 'project_getting_started',
};

/** Gaming SDK-access origin, preserving the old two-value `newOrg` split. */
export function docsFlowGamingOrigin(
  flow: DocsFlow | undefined
): 'onboarding' | 'project-creation' {
  return flow === 'onboarding' || flow === 'onboarding-scm'
    ? 'onboarding'
    : 'project-creation';
}
