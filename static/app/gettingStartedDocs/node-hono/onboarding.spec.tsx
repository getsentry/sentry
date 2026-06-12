import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {Runtime} from './utils';
import {docs} from '.';

describe('hono onboarding docs', () => {
  describe('Cloudflare Workers runtime (default)', () => {
    it('renders onboarding docs correctly', () => {
      renderWithOnboardingLayout(docs);

      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {name: /Upload Source Maps/i})
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

      expect(
        screen.getAllByText(textWithMarkupMatcher(/@sentry\/cloudflare/)).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText(textWithMarkupMatcher(/nodejs_compat/)).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByText(
          textWithMarkupMatcher(/import { sentry } from "@sentry\/hono\/cloudflare"/)
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/sentry\(app, \{/))
      ).toBeInTheDocument();
    });

    it('displays tracesSampleRate when performance is selected', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
        ],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
      ).toBeInTheDocument();
    });

    it('enables logs by setting enableLogs to true', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/enableLogs: true/))
      ).toBeInTheDocument();
    });

    it('does not enable logs when not selected', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING],
      });

      expect(
        screen.queryByText(textWithMarkupMatcher(/enableLogs: true/))
      ).not.toBeInTheDocument();
    });

    it('shows profiling info alert when profiling is selected', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
      });

      expect(
        screen.getByText(
          textWithMarkupMatcher(/Profiling is only available on the Node.js runtime/)
        )
      ).toBeInTheDocument();
    });

    it('does not show profiling alert when profiling is not selected', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING],
      });

      expect(
        screen.queryByText(
          textWithMarkupMatcher(/Profiling is only available on the Node.js runtime/)
        )
      ).not.toBeInTheDocument();
    });
  });

  describe('Node.js runtime', () => {
    let nodeDocs: typeof docs;
    beforeAll(() => {
      nodeDocs = {
        ...docs,
        platformOptions: {
          ...docs.platformOptions,
          runtime: {
            ...docs.platformOptions!.runtime,
            defaultValue: Runtime.NODE,
          },
        },
      };
    });

    it('renders onboarding docs correctly', () => {
      renderWithOnboardingLayout(nodeDocs);

      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {name: /Upload Source Maps/i})
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

      expect(
        screen.getByText(
          textWithMarkupMatcher(/import \* as Sentry from "@sentry\/hono\/node"/)
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          textWithMarkupMatcher(/import { sentry } from "@sentry\/hono\/node"/)
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/app\.use\(sentry\(app\)\)/))
      ).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/node --import .\/instrument.mjs app.js/))
      ).toBeInTheDocument();
    });

    it('displays tracesSampleRate when performance is selected', () => {
      renderWithOnboardingLayout(nodeDocs, {
        selectedProducts: [
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
        ],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
      ).toBeInTheDocument();
    });

    it('enables profiling by setting profiling samplerates', () => {
      renderWithOnboardingLayout(nodeDocs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
      });

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            /import { nodeProfilingIntegration } from "@sentry\/profiling-node"/
          )
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
      ).toBeInTheDocument();
    });

    it('continuous profiling', () => {
      const organization = OrganizationFixture({
        features: ['continuous-profiling'],
      });

      renderWithOnboardingLayout(
        nodeDocs,
        {},
        {
          organization,
        }
      );

      expect(
        screen.getByText(textWithMarkupMatcher(/profileLifecycle: 'trace'/))
      ).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/profileSessionSampleRate: 1\.0/))
      ).toBeInTheDocument();

      expect(
        screen.queryByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
      ).not.toBeInTheDocument();
    });

    it('enables logs by setting enableLogs to true', () => {
      renderWithOnboardingLayout(nodeDocs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/enableLogs: true/))
      ).toBeInTheDocument();
    });

    it('does not enable logs when not selected', () => {
      renderWithOnboardingLayout(nodeDocs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING],
      });

      expect(
        screen.queryByText(textWithMarkupMatcher(/enableLogs: true/))
      ).not.toBeInTheDocument();
    });

    it('does not show profiling alert when profiling is selected', () => {
      renderWithOnboardingLayout(nodeDocs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
      });

      expect(
        screen.queryByText(
          textWithMarkupMatcher(/Profiling is only available on the Node.js runtime/)
        )
      ).not.toBeInTheDocument();
    });
  });

  describe('Bun runtime', () => {
    let bunDocs: typeof docs;
    beforeAll(() => {
      bunDocs = {
        ...docs,
        platformOptions: {
          ...docs.platformOptions,
          runtime: {
            ...docs.platformOptions!.runtime,
            defaultValue: Runtime.BUN,
          },
        },
      };
    });

    it('renders onboarding docs correctly', () => {
      renderWithOnboardingLayout(bunDocs);

      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {name: /Upload Source Maps/i})
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

      expect(
        screen.getAllByText(textWithMarkupMatcher(/@sentry\/bun/)).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByText(
          textWithMarkupMatcher(/import { sentry } from "@sentry\/hono\/bun"/)
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/sentry\(app, \{/))
      ).toBeInTheDocument();
    });

    it('displays tracesSampleRate when performance is selected', () => {
      renderWithOnboardingLayout(bunDocs, {
        selectedProducts: [
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
        ],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
      ).toBeInTheDocument();
    });

    it('enables logs by setting enableLogs to true', () => {
      renderWithOnboardingLayout(bunDocs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/enableLogs: true/))
      ).toBeInTheDocument();
    });

    it('shows profiling info alert when profiling is selected', () => {
      renderWithOnboardingLayout(bunDocs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
      });

      expect(
        screen.getByText(
          textWithMarkupMatcher(/Profiling is only available on the Node.js runtime/)
        )
      ).toBeInTheDocument();
    });
  });

  describe('Deno runtime', () => {
    let denoDocs: typeof docs;
    beforeAll(() => {
      denoDocs = {
        ...docs,
        platformOptions: {
          ...docs.platformOptions,
          runtime: {
            ...docs.platformOptions!.runtime,
            defaultValue: Runtime.DENO,
          },
        },
      };
    });

    it('renders onboarding docs correctly', () => {
      renderWithOnboardingLayout(denoDocs);

      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {name: /Upload Source Maps/i})
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

      expect(
        screen.getAllByText(textWithMarkupMatcher(/@sentry\/deno/)).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByText(
          textWithMarkupMatcher(/import { sentry } from "@sentry\/hono\/deno"/)
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/Deno\.serve\(app\.fetch\)/))
      ).toBeInTheDocument();
      expect(
        screen.getByText(textWithMarkupMatcher(/sentry\(app, \{/))
      ).toBeInTheDocument();
    });

    it('displays tracesSampleRate when performance is selected', () => {
      renderWithOnboardingLayout(denoDocs, {
        selectedProducts: [
          ProductSolution.ERROR_MONITORING,
          ProductSolution.PERFORMANCE_MONITORING,
        ],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
      ).toBeInTheDocument();
    });

    it('enables logs by setting enableLogs to true', () => {
      renderWithOnboardingLayout(denoDocs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
      });

      expect(
        screen.getByText(textWithMarkupMatcher(/enableLogs: true/))
      ).toBeInTheDocument();
    });

    it('shows profiling info alert when profiling is selected', () => {
      renderWithOnboardingLayout(denoDocs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
      });

      expect(
        screen.getByText(
          textWithMarkupMatcher(/Profiling is only available on the Node.js runtime/)
        )
      ).toBeInTheDocument();
    });
  });

  describe('shared behavior', () => {
    it('displays logs integration next step when logs are selected', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
      });

      expect(screen.getByText('Logging Integrations')).toBeInTheDocument();
    });

    it('does not display logs integration next step when logs are not selected', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING],
      });

      expect(screen.queryByText('Logging Integrations')).not.toBeInTheDocument();
    });

    it('displays logging code in verify section when logs are selected', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
      });

      expect(
        screen.getByText(
          textWithMarkupMatcher(/Sentry\.logger\.info\('User triggered test error'/)
        )
      ).toBeInTheDocument();
    });

    it('displays metrics code in verify section when metrics are selected', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.METRICS],
      });

      expect(
        screen.getByText(
          textWithMarkupMatcher(/Sentry\.metrics\.count\('test_counter', 1\)/)
        )
      ).toBeInTheDocument();
    });

    it('does not display metrics code in verify section when metrics are not selected', () => {
      renderWithOnboardingLayout(docs, {
        selectedProducts: [ProductSolution.ERROR_MONITORING],
      });

      expect(
        screen.queryByText(
          textWithMarkupMatcher(/Sentry\.metrics\.count\('test_counter', 1\)/)
        )
      ).not.toBeInTheDocument();
    });
  });
});
