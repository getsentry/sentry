import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from './solidstart';

describe('javascript-solidstart onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes import statement
    expect(
      screen.getByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/solidstart"/)
      )
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
      screen.getByText(textWithMarkupMatcher(/solidRouterBrowserTracingIntegration\(\)/))
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

  it('includes SolidStart specific configurations', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    // Check for SolidStart specific setup
    expect(
      screen.getByText(textWithMarkupMatcher(/sentryBeforeResponseMiddleware/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/withSentryRouterRouting/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/instrument\.server\.mjs/))
    ).toBeInTheDocument();
  });

  it('includes server instrumentation setup', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(
        textWithMarkupMatcher(/NODE_OPTIONS.*--import.*instrument\.server\.mjs/)
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/entry-client\.tsx/))
    ).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher(/middleware\.ts/))).toBeInTheDocument();
  });

  it('displays test error button in verify section', () => {
    renderWithOnboardingLayout(docs);

    expect(screen.getByText(textWithMarkupMatcher(/Throw error/))).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry Frontend Error/))
    ).toBeInTheDocument();
  });
});
