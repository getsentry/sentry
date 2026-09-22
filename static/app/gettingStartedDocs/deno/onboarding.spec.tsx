import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('deno onboarding docs', () => {
  it('renders doc correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders the instrument file and the entry point that imports it
    expect(
      screen.getAllByText(
        textWithMarkupMatcher(/import \* as Sentry from "npm:@sentry\/deno";/)
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(textWithMarkupMatcher(/import "\.\/instrument\.ts";/))
    ).toBeInTheDocument();

    // Renders config options
    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0,/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/dataCollection: \{/))
    ).toBeInTheDocument();
  });

  it('renders the auto-instrumentation step when tracing is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
    });

    expect(
      screen.getByText(
        textWithMarkupMatcher(/deno run --import=@sentry\/deno\/import main\.ts/)
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Tracing')).toBeInTheDocument();
  });

  it('renders without tracing', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0,/))
    ).not.toBeInTheDocument();

    // Does not render the auto-instrumentation step
    expect(
      screen.queryByText(textWithMarkupMatcher(/deno run --import=/))
    ).not.toBeInTheDocument();
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
    expect(screen.getByText('Logging Integrations')).toBeInTheDocument();
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
    expect(screen.getByText('Application Metrics')).toBeInTheDocument();
  });

  it('does not display logs or metrics code when they are not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(
        textWithMarkupMatcher(/Sentry\.logger\.info\('User triggered test error'/)
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        textWithMarkupMatcher(/Sentry\.metrics\.count\('test_counter', 1\)/)
      )
    ).not.toBeInTheDocument();
  });
});
