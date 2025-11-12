import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('javascript-gatsby onboarding docs', () => {
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
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/gatsby"/)
      )[0]
    ).toBeInTheDocument();
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
      screen.getByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
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

  it('includes performance and tracing configurations', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.browserTracingIntegration\(\)/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/tracePropagationTargets/))
    ).toBeInTheDocument();
  });

  it('includes replay integration when session replay is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.replayIntegration\(/))
    ).toBeInTheDocument();
  });

  it('includes sendDefaultPii configuration', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(textWithMarkupMatcher(/sendDefaultPii: true/))
    ).toBeInTheDocument();
  });

  it('includes gatsby-config.js configuration', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getAllByText(textWithMarkupMatcher(/gatsby-config\.js/))[0]
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(textWithMarkupMatcher(/@sentry\/gatsby/))[0]
    ).toBeInTheDocument();
  });

  it('includes sentry.config.js file configuration', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getAllByText(textWithMarkupMatcher(/sentry\.config\.js/))[0]
    ).toBeInTheDocument();
  });

  it('includes verification with test error', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(textWithMarkupMatcher(/throw new Error\("Sentry Test Error"\)/))
    ).toBeInTheDocument();
  });

  it('includes logs in verify snippet when logs is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.logger\.info/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/User triggered test error button/))
    ).toBeInTheDocument();
  });

  it('does not include logs in verify snippet when logs is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/Sentry\.logger\.info/))
    ).not.toBeInTheDocument();
  });

  // Note: Feedback integration tests cannot be added due to isFeedbackSelected being hardcoded to false
  // in the OnboardingLayout component. When this is fixed, tests should be added to verify:
  // - Sentry.feedbackIntegration() is included when feedback is selected
  // - colorScheme: "system" is configured
  // - Feedback configuration options are applied

  it('has metrics onboarding configuration', () => {
    expect(docs.metricsOnboarding).toBeDefined();
    expect(docs.metricsOnboarding?.install).toBeDefined();
    expect(docs.metricsOnboarding?.configure).toBeDefined();
    expect(docs.metricsOnboarding?.verify).toBeDefined();
  });

  it('does not show Metrics in next steps when metrics is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
  });
});
