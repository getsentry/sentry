import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('javascript-tanstackstart-react onboarding docs', () => {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Set up the SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    expect(
      screen.getAllByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/tanstackstart-react"/)
      ).length
    ).toBeGreaterThanOrEqual(2);
  });

  it('displays sample rates when performance and replay are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

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

  it('includes tanstackRouterBrowserTracingIntegration when performance is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(
      screen.getByText(
        textWithMarkupMatcher(/Sentry\.tanstackRouterBrowserTracingIntegration/)
      )
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

  it('displays verify instructions', () => {
    renderWithOnboardingLayout(docs);

    expect(screen.getAllByText(textWithMarkupMatcher(/Break the world/))).toHaveLength(2);
  });

  it('has metrics onboarding configuration', () => {
    expect(docs.metricsOnboarding).toBeDefined();
    expect(docs.metricsOnboarding?.install).toBeDefined();
    expect(docs.metricsOnboarding?.configure).toBeDefined();
    expect(docs.metricsOnboarding?.verify).toBeDefined();
  });
});
