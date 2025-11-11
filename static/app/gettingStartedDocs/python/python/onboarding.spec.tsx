import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('python onboarding docs', () => {
  it('renders doc correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  it('renders without tracing', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/profiles_sample_rate=1\.0,/))
    ).not.toBeInTheDocument();

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/traces_sample_rate=1\.0,/))
    ).not.toBeInTheDocument();
  });

  it('renders transaction profiling', () => {
    renderWithOnboardingLayout(docs);

    // Does not render continuous profiling config
    expect(
      screen.queryByText(textWithMarkupMatcher(/profile_session_sample_rate=1\.0,/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/sentry_sdk.profiler.start_profiler\(\)/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/sentry_sdk.profiler.stop_profiler\(\)/))
    ).not.toBeInTheDocument();

    // Does render transaction profiling config
    expect(
      screen.getByText(textWithMarkupMatcher(/profiles_sample_rate=1\.0,/))
    ).toBeInTheDocument();
  });

  it('renders continuous profiling', () => {
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

    // Does not render transaction profiling config
    expect(
      screen.queryByText(textWithMarkupMatcher(/profiles_sample_rate=1\.0,/))
    ).not.toBeInTheDocument();

    // Does render continuous profiling config
    expect(
      screen.getByText(textWithMarkupMatcher(/profile_session_sample_rate=1\.0,/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/sentry_sdk.profiler.start_profiler\(\)/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/sentry_sdk.profiler.stop_profiler\(\)/))
    ).toBeInTheDocument();
  });

  it('renders logs configuration when logs are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.LOGS],
    });

    // Should render logs config option
    expect(
      screen.getByText(textWithMarkupMatcher(/enable_logs=True,/))
    ).toBeInTheDocument();

    // Should render logs verification steps
    expect(
      screen.getByText(textWithMarkupMatcher(/sentry_sdk.logger.info/))
    ).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher(/import logging/))).toBeInTheDocument();
  });

  it('renders without logs configuration when logs are not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Should not render logs config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/enable_logs=True,/))
    ).not.toBeInTheDocument();
  });

  it('renders metrics configuration when metrics are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.METRICS],
    });

    // Renders metrics verification steps
    expect(
      screen.getByText(
        'Send test metrics from your app to verify metrics are arriving in Sentry.'
      )
    ).toBeInTheDocument();
  });

  it('renders without metrics configuration when metrics are not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Does not render metrics verification steps
    expect(
      screen.queryByText(
        'Send test metrics from your app to verify metrics are arriving in Sentry.'
      )
    ).not.toBeInTheDocument();
  });
});
