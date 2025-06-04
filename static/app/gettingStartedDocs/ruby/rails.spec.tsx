import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from './rails';

describe('rails onboarding docs', function () {
  it('renders errors onboarding doc correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders config options
    expect(
      screen.getByText(textWithMarkupMatcher(/config.breadcrumbs_logger/))
    ).toBeInTheDocument();

    // Renders import
    expect(
      screen.getByText(textWithMarkupMatcher(/gem \"sentry-ruby\"/))
    ).toBeInTheDocument();
  });

  it('renders performance onboarding docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/config.traces_sample_rate/))
    ).toBeInTheDocument();
  });

  it('renders profiling onboarding docs correctly', async function () {
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
});
