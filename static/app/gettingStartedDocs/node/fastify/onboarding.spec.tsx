import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('fastify onboarding docs', () => {
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
    const allMatches = screen.getAllByText(
      textWithMarkupMatcher(/import \* as Sentry from "@sentry\/node"/)
    );
    allMatches.forEach(match => {
      expect(match).toBeInTheDocument();
    });
  });

  it('includes error handler', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.setupFastifyErrorHandler\(app\)/))
    ).toBeInTheDocument();
  });

  it('displays sample rates by default', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate/))
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

  it('does not enable logs when not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/enableLogs: true/))
    ).not.toBeInTheDocument();
  });

  it('displays logs integration next step when logs are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    expect(screen.getByText('Logging Integrations')).toBeInTheDocument();
  });

  it('does not display logs integration next step when logs are not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(screen.queryByText('Logging Integrations')).not.toBeInTheDocument();
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
  });

  it('does not display logging code in verify section when logs are not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(
        textWithMarkupMatcher(/Sentry\.logger\.info\('User triggered test error'/)
      )
    ).not.toBeInTheDocument();
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

  it('enables profiling by setting profiling samplerates', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
    });

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /const { nodeProfilingIntegration } = require\("@sentry\/profiling-node"\)/
        )
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('continuous profiling', () => {
    const organization = OrganizationFixture({
      features: ['continuous-profiling'],
    });

    renderWithOnboardingLayout(
      docs,
      {},
      {
        organization,
      }
    );

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /const { nodeProfilingIntegration } = require\("@sentry\/profiling-node"\)/
        )
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher(/profileLifecycle: 'trace'/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/profileSessionSampleRate: 1\.0/))
    ).toBeInTheDocument();

    // Profiles sample rate should not be set for continuous profiling
    expect(
      screen.queryByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
    ).not.toBeInTheDocument();
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
  });

  it('does not display metrics code in verify section when metrics are not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(
        textWithMarkupMatcher(/Sentry\.metrics\.count\('test_counter', 1\)/)
      )
    ).not.toBeInTheDocument();
  });

  it('displays Metrics in next steps when metrics are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.METRICS],
    });

    expect(screen.getByText('Metrics')).toBeInTheDocument();
  });

  it('does not display Metrics in next steps when metrics are not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
  });
});
