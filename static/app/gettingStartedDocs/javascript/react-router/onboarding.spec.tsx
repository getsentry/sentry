import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('javascript-react-router onboarding docs', () => {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: /Upload Source Maps/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes Sentry import statement in multiple configure sections
    expect(
      screen.getAllByText(
        textWithMarkupMatcher(/import \* as Sentry from ["']@sentry\/react-router["'];/)
      )
    ).toHaveLength(4);
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
      screen.getAllByText(textWithMarkupMatcher(/tracesSampleRate/)).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(textWithMarkupMatcher(/replaysSessionSampleRate/)).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(textWithMarkupMatcher(/replaysOnErrorSampleRate/)).length
    ).toBeGreaterThan(0);
  });

  it('enables performance by setting tracesSampleRate to 1 and adding integration', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(
      screen.getAllByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/)).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.reactRouterTracingIntegration\(\)/))
    ).toBeInTheDocument();
  });

  it('enables replay by setting replay sample rates', () => {
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
      screen.getByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/nodeProfilingIntegration\(\)/))
    ).toBeInTheDocument();
  });

  it('enables logs by setting enableLogs to true and shows logger usage in verify step', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    expect(
      screen.getAllByText(textWithMarkupMatcher(/enableLogs: true/)).length
    ).toBeGreaterThan(0);

    // When logs are selected, verify step includes a Sentry logger call
    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.logger\.info\(/))
    ).toBeInTheDocument();
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
