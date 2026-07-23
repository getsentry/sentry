import {
  docsFlowGamingOrigin,
  DSN_COPIED_EVENT,
  JS_LOADER_NPM_DOCS_SHOWN_EVENT,
  MARKDOWN_SOURCE_BY_FLOW,
  NEXT_STEP_CLICKED_EVENT,
  resolveDocsFlowEvent,
  SETUP_LOADER_DOCS_RENDERED_EVENT,
  SOURCE_MAPS_COPY_CLICKED_EVENT,
  SOURCE_MAPS_SELECTED_AND_COPIED_EVENT,
} from 'sentry/components/onboarding/gettingStartedDoc/docsFlowAnalytics';

describe('docsFlowAnalytics', () => {
  it('preserves the old two-way onboarding event branches', () => {
    expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'onboarding')).toBe(
      'onboarding.dsn-copied'
    );
    expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'onboarding-scm')).toBe(
      'onboarding.scm_dsn_copied'
    );
    expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'project-creation')).toBe(
      'onboarding.dsn-copied'
    );
    expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'project-creation-scm')).toBe(
      'onboarding.dsn-copied'
    );
    expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, undefined)).toBe(
      'onboarding.dsn-copied'
    );

    expect(resolveDocsFlowEvent(NEXT_STEP_CLICKED_EVENT, 'project-creation')).toBe(
      'onboarding.next_step_clicked'
    );
    expect(resolveDocsFlowEvent(JS_LOADER_NPM_DOCS_SHOWN_EVENT, 'project-creation')).toBe(
      'onboarding.js_loader_npm_docs_shown'
    );
    expect(
      resolveDocsFlowEvent(SETUP_LOADER_DOCS_RENDERED_EVENT, 'project-creation')
    ).toBe('onboarding.setup_loader_docs_rendered');
  });

  it('preserves the old three-way source-map event branches', () => {
    expect(resolveDocsFlowEvent(SOURCE_MAPS_COPY_CLICKED_EVENT, 'onboarding')).toBe(
      'onboarding.source_maps_wizard_button_copy_clicked'
    );
    expect(resolveDocsFlowEvent(SOURCE_MAPS_COPY_CLICKED_EVENT, 'onboarding-scm')).toBe(
      'onboarding.scm_source_maps_wizard_button_copy_clicked'
    );
    expect(resolveDocsFlowEvent(SOURCE_MAPS_COPY_CLICKED_EVENT, 'project-creation')).toBe(
      'project_creation.source_maps_wizard_button_copy_clicked'
    );
    expect(
      resolveDocsFlowEvent(SOURCE_MAPS_COPY_CLICKED_EVENT, 'project-creation-scm')
    ).toBe('project_creation.source_maps_wizard_button_copy_clicked');
    expect(resolveDocsFlowEvent(SOURCE_MAPS_COPY_CLICKED_EVENT, undefined)).toBe(
      'project_creation.source_maps_wizard_button_copy_clicked'
    );
    expect(resolveDocsFlowEvent(SOURCE_MAPS_SELECTED_AND_COPIED_EVENT, undefined)).toBe(
      'project_creation.source_maps_wizard_selected_and_copied'
    );
  });

  it('preserves copy-as-markdown source values', () => {
    expect(MARKDOWN_SOURCE_BY_FLOW.onboarding).toBe('first_time_setup');
    expect(MARKDOWN_SOURCE_BY_FLOW['onboarding-scm']).toBe('first_time_setup');
    expect(MARKDOWN_SOURCE_BY_FLOW['project-creation']).toBe('project_getting_started');
    expect(MARKDOWN_SOURCE_BY_FLOW['project-creation-scm']).toBe(
      'project_getting_started'
    );
  });

  it('preserves the two-value gaming origin taxonomy', () => {
    expect(docsFlowGamingOrigin('onboarding')).toBe('onboarding');
    expect(docsFlowGamingOrigin('onboarding-scm')).toBe('onboarding');
    expect(docsFlowGamingOrigin('project-creation')).toBe('project-creation');
    expect(docsFlowGamingOrigin('project-creation-scm')).toBe('project-creation');
    expect(docsFlowGamingOrigin(undefined)).toBe('project-creation');
  });
});
