import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from './tanstackstart-react';

describe('javascript-tanstackstart-react onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Set up the SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes TanStack Start specific configuration
    expect(
      screen.getAllByText(textWithMarkupMatcher(/wrapVinxiConfigWithSentry/))
    ).toHaveLength(2); // Appears in descriptive text and code snippet
  });

  it('displays TanStack Start specific integrations when products are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tanstackRouterBrowserTracingIntegration/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replayIntegration/))
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(textWithMarkupMatcher(/sentryGlobalServerMiddlewareHandler/))
    ).toHaveLength(2); // Appears in descriptive text and code snippet
  });

  it('enables performance tracing integration', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tanstackRouterBrowserTracingIntegration/))
    ).toBeInTheDocument();
  });

  it('includes TanStack Start specific server instrumentation', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getAllByText(textWithMarkupMatcher(/wrapStreamHandlerWithSentry/))
    ).toHaveLength(2); // Appears in descriptive text and code snippet
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

  it('enables logs by setting enableLogs to true', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    expect(screen.getAllByText(textWithMarkupMatcher(/enableLogs: true/))).toHaveLength(
      2
    ); // Should appear in both client and server configurations
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
});
