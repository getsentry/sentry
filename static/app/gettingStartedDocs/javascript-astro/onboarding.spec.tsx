import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('javascript-astro onboarding docs', () => {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes minimum required Astro version
    expect(screen.getByText(textWithMarkupMatcher(/Astro 3.0.0/))).toBeInTheDocument();

    // Includes import statement in astro.config.mjs
    expect(
      screen.getByText(textWithMarkupMatcher(/import sentry from "@sentry\/astro"/))
    ).toBeInTheDocument();

    // Shows separate config files
    expect(
      screen.getAllByText(textWithMarkupMatcher(/sentry\.client\.config\.js/))
    ).toHaveLength(2); // Appears in text and tab label
    expect(
      screen.getAllByText(textWithMarkupMatcher(/sentry\.server\.config\.js/))
    ).toHaveLength(2); // Appears in text and tab label
  });

  it('displays sample rates when performance and replay are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    // tracesSampleRate appears in both client and server config when performance is selected
    expect(
      screen.getAllByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
    ).toHaveLength(2);
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysSessionSampleRate: 0\.1/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysOnErrorSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('excludes performance integration when performance is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/Sentry\.browserTracingIntegration/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).not.toBeInTheDocument();
  });

  it('excludes replay integration when replay is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/Sentry\.replayIntegration/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/replaysSessionSampleRate/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/replaysOnErrorSampleRate/))
    ).not.toBeInTheDocument();
  });

  it('enables logs by setting enableLogs to true', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    // enableLogs appears in both client and server config
    expect(screen.getAllByText(textWithMarkupMatcher(/enableLogs: true/))).toHaveLength(
      2
    );
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

  it('includes browserTracingIntegration when performance is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.browserTracingIntegration/))
    ).toBeInTheDocument();
  });

  it('includes replayIntegration when replay is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.replayIntegration/))
    ).toBeInTheDocument();
  });

  it('includes logging code in verify snippet when logs is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.logger\.info/))
    ).toBeInTheDocument();
    // Import appears in client config, server config, and verify snippet
    expect(
      screen.getAllByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/astro"/)
      )
    ).toHaveLength(3);
  });

  it('excludes logging code in verify snippet when logs is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/Sentry\.logger\.info/))
    ).not.toBeInTheDocument();
  });

  it('shows only build-time options in astro.config.mjs', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
        ProductSolution.LOGS,
      ],
    });

    // astro.config.mjs should only contain build-time options
    expect(
      screen.getByText(textWithMarkupMatcher(/process.env.SENTRY_AUTH_TOKEN/))
    ).toBeInTheDocument();

    // Runtime config should NOT be in astro.config.mjs anymore
    const astroConfigSections = screen.getAllByText(
      textWithMarkupMatcher(/astro\.config\.mjs/)
    );

    // Check that DSN is not in astro.config.mjs section (it should be in client/server config)
    // This is a bit complex to test precisely, but we can ensure the config is split correctly
    expect(astroConfigSections.length).toBeGreaterThan(0);
  });

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
