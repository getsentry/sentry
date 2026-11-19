import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('getting started with ruby', () => {
  it('renders errors onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  it('renders performance onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/config.traces_sample_rate/))
    ).toBeInTheDocument();
  });

  it('renders profiling onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
      ],
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/config.profiles_sample_rate/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(textWithMarkupMatcher(/Ruby Profiling beta is available/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/Make sure stackprof is loaded before sentry-ruby/)
      )
    ).toBeInTheDocument();
  });

  it('does not suggest the removed enable_logs option', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/config.enable_logs/))
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/config.enabled_patches = \[:logger\]/))
    ).toBeInTheDocument();
  });
});
