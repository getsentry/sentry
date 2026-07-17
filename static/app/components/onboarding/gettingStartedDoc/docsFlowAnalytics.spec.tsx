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
  describe('resolveDocsFlowEvent', () => {
    it('maps each flow to a distinct dsn-copied event', () => {
      expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'onboarding')).toBe(
        'onboarding.dsn-copied'
      );
      expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'onboarding-scm')).toBe(
        'onboarding.scm_dsn_copied'
      );
      expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'project-creation')).toBe(
        'project_creation.dsn_copied'
      );
      expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'project-creation-scm')).toBe(
        'project_creation.scm_dsn_copied'
      );
    });

    it('falls back to the legacy project-creation name when the flow is undefined', () => {
      // Peripheral surfaces (e.g. updatedEmptyState) build DocsParams without a
      // docsFlow; they must keep emitting the pre-enum project-creation names.
      expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, undefined)).toBe(
        'project_creation.dsn_copied'
      );
      expect(resolveDocsFlowEvent(SOURCE_MAPS_COPY_CLICKED_EVENT, undefined)).toBe(
        'project_creation.source_maps_wizard_button_copy_clicked'
      );
    });

    it('reproduces the exact onboarding names for the regression-gated flows', () => {
      expect(resolveDocsFlowEvent(NEXT_STEP_CLICKED_EVENT, 'onboarding')).toBe(
        'onboarding.next_step_clicked'
      );
      expect(resolveDocsFlowEvent(NEXT_STEP_CLICKED_EVENT, 'onboarding-scm')).toBe(
        'onboarding.scm_next_step_clicked'
      );
      expect(resolveDocsFlowEvent(JS_LOADER_NPM_DOCS_SHOWN_EVENT, 'onboarding')).toBe(
        'onboarding.js_loader_npm_docs_shown'
      );
      expect(
        resolveDocsFlowEvent(SETUP_LOADER_DOCS_RENDERED_EVENT, 'onboarding-scm')
      ).toBe('onboarding.scm_setup_loader_docs_rendered');
      expect(
        resolveDocsFlowEvent(SOURCE_MAPS_SELECTED_AND_COPIED_EVENT, 'onboarding')
      ).toBe('onboarding.source_maps_wizard_selected_and_copied');
    });

    it('splits SCM project creation into its own bucket', () => {
      expect(
        resolveDocsFlowEvent(SOURCE_MAPS_COPY_CLICKED_EVENT, 'project-creation-scm')
      ).toBe('project_creation.scm_source_maps_wizard_button_copy_clicked');
      expect(
        resolveDocsFlowEvent(JS_LOADER_NPM_DOCS_SHOWN_EVENT, 'project-creation-scm')
      ).toBe('project_creation.scm_js_loader_npm_docs_shown');
    });
  });

  describe('MARKDOWN_SOURCE_BY_FLOW', () => {
    it('splits the copy-as-markdown source by SCM (Q2)', () => {
      expect(MARKDOWN_SOURCE_BY_FLOW.onboarding).toBe('first_time_setup');
      expect(MARKDOWN_SOURCE_BY_FLOW['onboarding-scm']).toBe('first_time_setup_scm');
      expect(MARKDOWN_SOURCE_BY_FLOW['project-creation']).toBe('project_getting_started');
      expect(MARKDOWN_SOURCE_BY_FLOW['project-creation-scm']).toBe(
        'project_getting_started_scm'
      );
    });
  });

  describe('docsFlowGamingOrigin', () => {
    it('collapses onto the 2-value origin taxonomy (Q1: no SCM split)', () => {
      expect(docsFlowGamingOrigin('onboarding')).toBe('onboarding');
      expect(docsFlowGamingOrigin('onboarding-scm')).toBe('onboarding');
      expect(docsFlowGamingOrigin('project-creation')).toBe('project-creation');
      expect(docsFlowGamingOrigin('project-creation-scm')).toBe('project-creation');
    });

    it('defaults an undefined flow to project-creation', () => {
      expect(docsFlowGamingOrigin(undefined)).toBe('project-creation');
    });
  });
});
