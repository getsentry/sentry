import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('bun onboarding docs', () => {
  it('renders doc correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders the instrument file and the entry point that imports it
    expect(
      screen.getAllByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/bun";/)
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(textWithMarkupMatcher(/import "\.\/instrument\.ts";/))
    ).toBeInTheDocument();

    // Renders the build step, which is what injects the library instrumentation
    expect(
      screen.getByText(textWithMarkupMatcher(/plugins: \[sentryBunPlugin\(\)\],/))
    ).toBeInTheDocument();

    // Renders the filename header above each snippet
    expect(screen.getByText('build.ts')).toBeInTheDocument();

    // Renders config options
    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0,/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/dataCollection: \{/))
    ).toBeInTheDocument();
  });

  it('renders the outgoing request note when tracing is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/are not traced on Bun yet/))
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

    // Does not render the outgoing request note
    expect(
      screen.queryByText(textWithMarkupMatcher(/are not traced on Bun yet/))
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
