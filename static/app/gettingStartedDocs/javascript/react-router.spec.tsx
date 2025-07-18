import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from './react-router';

describe('javascript-react-router onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes import statement
    expect(
      screen.getByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/react-router"/)
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
      screen.getByText(textWithMarkupMatcher(/reactRouterTracingIntegration\(\)/))
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
      screen.getByText(textWithMarkupMatcher(/replayIntegration\(/))
    ).toBeInTheDocument();
  });

  it('enables profiling when selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/nodeProfilingIntegration\(\)/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('includes React Router specific configurations', () => {
    renderWithOnboardingLayout(docs);

    // Check for React Router specific setup
    expect(
      screen.getByText(textWithMarkupMatcher(/createSentryHandleRequest/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/handleError: HandleErrorFunction/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/captureException\(error\)/))
    ).toBeInTheDocument();
  });

  it('includes server and client setup', () => {
    renderWithOnboardingLayout(docs);

    // Check for client setup
    expect(
      screen.getByText(textWithMarkupMatcher(/entry\.client\.tsx/))
    ).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher(/HydratedRouter/))).toBeInTheDocument();

    // Check for server setup
    expect(
      screen.getByText(textWithMarkupMatcher(/instrument\.server\.mjs/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/entry\.server\.tsx/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/react-router reveal/))
    ).toBeInTheDocument();
  });

  it('includes error boundary setup', () => {
    renderWithOnboardingLayout(docs);

    expect(screen.getByText(textWithMarkupMatcher(/ErrorBoundary/))).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/Route\.ErrorBoundaryProps/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/isRouteErrorResponse/))
    ).toBeInTheDocument();
  });

  it('includes package.json scripts update', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(
        textWithMarkupMatcher(/NODE_OPTIONS.*--import.*instrument\.server\.mjs/)
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/react-router dev/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/react-router-serve/))
    ).toBeInTheDocument();
  });

  it('displays test error route in verify section', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry Test Error/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/This page will throw an error!/))
    ).toBeInTheDocument();
  });
});
