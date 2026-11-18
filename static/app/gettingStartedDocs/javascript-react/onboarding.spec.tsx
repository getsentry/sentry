import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('javascript-react onboarding docs', () => {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: /Upload Source Maps/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes import statement
    expect(
      screen.getAllByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/react"/)
      )[0]
    ).toBeInTheDocument();
  });

  it('initializes Sentry in instrument.js and imports it first in the entry point', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText('instrument.js', {selector: '*:not(code)'})
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/^\/\/.*\nimport "\.\/instrument";/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(/import \{ createRoot \} from "react-dom\/client";/)
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/import App from "\.\/App";/))
    ).toBeInTheDocument();
  });

  it('captures React errors with reactErrorHandler and ErrorBoundary', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(
        textWithMarkupMatcher(/onUncaughtError: Sentry\.reactErrorHandler\(/)
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/<Sentry\.ErrorBoundary fallback=/))
    ).toBeInTheDocument();
  });

  it('keeps the init options indented and comma-separated', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
        ProductSolution.PROFILING,
      ],
    });

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /\n {2}integrations: \[\n {4}Sentry\.browserTracingIntegration\(\),\n/
        )
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /\n {2}replaysOnErrorSampleRate: 1\.0,\n {2}\/\/ Profiling\n/
        )
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/transactions/))
    ).not.toBeInTheDocument();
  });

  it('displays sample rates by default', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysSessionSampleRate/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysOnErrorSampleRate/))
    ).toBeInTheDocument();
  });

  it('enables performance setting the tracesSampleRate to 1', () => {
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

  it('enables replay by setting replay samplerates', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/replaysSessionSampleRate: 0\.1/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysOnErrorSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('enables profiling by setting profiling sample rates', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry.browserProfilingIntegration\(\)/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/profileSessionSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('includes metrics API calls in verify when metrics is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.METRICS],
    });

    expect(
      screen.getByText(
        textWithMarkupMatcher(/Sentry\.metrics\.count\('test_counter', 1\)/)
      )
    ).toBeInTheDocument();
  });

  it('shows Metrics in next steps when metrics is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.METRICS,
      ],
    });

    expect(screen.getByText('Application Metrics')).toBeInTheDocument();
  });

  it('does not show Metrics in next steps when metrics is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(screen.queryByText('Application Metrics')).not.toBeInTheDocument();
  });

  it('shows Logging Integrations in next steps when logs is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.LOGS,
      ],
    });

    expect(screen.getByText('Logging Integrations')).toBeInTheDocument();
  });

  it('does not show Logging Integrations in next steps when logs is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(screen.queryByText('Logging Integrations')).not.toBeInTheDocument();
  });

  it('has metrics onboarding configuration', () => {
    expect(docs.metricsOnboarding).toBeDefined();
    expect(docs.metricsOnboarding?.install).toBeDefined();
    expect(docs.metricsOnboarding?.configure).toBeDefined();
    expect(docs.metricsOnboarding?.verify).toBeDefined();
  });
});
