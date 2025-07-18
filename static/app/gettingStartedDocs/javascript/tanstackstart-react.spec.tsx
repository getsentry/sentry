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

    // Includes import statement
    expect(
      screen.getByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/tanstackstart-react"/)
      )
    ).toBeInTheDocument();

    // Includes configuration wrapper
    expect(
      screen.getByText(
        textWithMarkupMatcher(/wrapVinxiConfigWithSentry/)
      )
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
    expect(
      screen.getByText(textWithMarkupMatcher(/tanstackRouterBrowserTracingIntegration\(router\)/))
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
    expect(
      screen.getByText(textWithMarkupMatcher(/replayIntegration\(\)/))
    ).toBeInTheDocument();
  });

  it('includes TanStack Start specific configurations', () => {
    renderWithOnboardingLayout(docs);

    // Check for TanStack Start specific setup
    expect(
      screen.getByText(textWithMarkupMatcher(/wrapCreateRootRouteWithSentry/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/wrapStreamHandlerWithSentry/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/sentryGlobalServerMiddlewareHandler/))
    ).toBeInTheDocument();
  });

  it('includes error boundary configuration', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(textWithMarkupMatcher(/withErrorBoundary/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/captureException/))
    ).toBeInTheDocument();
  });

  it('displays test error button in verify section', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(textWithMarkupMatcher(/Break the world/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry Test Error/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/sentry-example-api/))
    ).toBeInTheDocument();
  });
});