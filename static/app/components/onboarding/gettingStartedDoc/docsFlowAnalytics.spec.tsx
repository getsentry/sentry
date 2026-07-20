import {
  docsFlowGamingOrigin,
  docsFlowMarkdownParams,
  docsFlowVariantParams,
  DSN_COPIED_EVENT,
  JS_LOADER_NPM_DOCS_SHOWN_EVENT,
  NEXT_STEP_CLICKED_EVENT,
  resolveDocsFlowEvent,
  SETUP_LOADER_DOCS_RENDERED_EVENT,
  SOURCE_MAPS_COPY_CLICKED_EVENT,
  SOURCE_MAPS_SELECTED_AND_COPIED_EVENT,
} from 'sentry/components/onboarding/gettingStartedDoc/docsFlowAnalytics';

describe('docsFlowAnalytics', () => {
  describe('resolveDocsFlowEvent', () => {
    it('keeps distinct names for the onboarding arms', () => {
      expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'onboarding')).toBe(
        'onboarding.dsn-copied'
      );
      expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'onboarding-scm')).toBe(
        'onboarding.scm_dsn_copied'
      );
    });

    it('resolves BOTH project-creation arms to the same base name (SCM lives in variant)', () => {
      expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'project-creation')).toBe(
        'project_creation.dsn_copied'
      );
      expect(resolveDocsFlowEvent(DSN_COPIED_EVENT, 'project-creation-scm')).toBe(
        'project_creation.dsn_copied'
      );
      expect(
        resolveDocsFlowEvent(SOURCE_MAPS_COPY_CLICKED_EVENT, 'project-creation-scm')
      ).toBe('project_creation.source_maps_wizard_button_copy_clicked');
      expect(
        resolveDocsFlowEvent(JS_LOADER_NPM_DOCS_SHOWN_EVENT, 'project-creation-scm')
      ).toBe('project_creation.js_loader_npm_docs_shown');
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
  });

  describe('docsFlowVariantParams', () => {
    it('stamps the SCM/legacy variant only for the project-creation arms', () => {
      expect(docsFlowVariantParams('project-creation-scm')).toEqual({variant: 'scm'});
      expect(docsFlowVariantParams('project-creation')).toEqual({variant: 'legacy'});
    });

    it('omits variant for the onboarding arms (their events are onboarding.*)', () => {
      expect(docsFlowVariantParams('onboarding')).toEqual({});
      expect(docsFlowVariantParams('onboarding-scm')).toEqual({});
    });

    it('omits variant when project-creation origin is unmarked', () => {
      expect(docsFlowVariantParams(undefined)).toEqual({});
    });
  });

  describe('docsFlowMarkdownParams', () => {
    it('sets source by flow and variant by SCM experience', () => {
      expect(docsFlowMarkdownParams('onboarding')).toEqual({
        source: 'first_time_setup',
        variant: 'legacy',
      });
      expect(docsFlowMarkdownParams('onboarding-scm')).toEqual({
        source: 'first_time_setup',
        variant: 'scm',
      });
      expect(docsFlowMarkdownParams('project-creation')).toEqual({
        source: 'project_getting_started',
        variant: 'legacy',
      });
      expect(docsFlowMarkdownParams('project-creation-scm')).toEqual({
        source: 'project_getting_started',
        variant: 'scm',
      });
    });

    it('keeps the project source but omits variant when origin is unmarked', () => {
      expect(docsFlowMarkdownParams(undefined)).toEqual({
        source: 'project_getting_started',
      });
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
