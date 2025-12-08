import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('php onboarding docs', () => {
  it('renders doc correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders install instructions
    expect(
      screen.getByText(textWithMarkupMatcher(/composer require sentry\/sentry/))
    ).toBeInTheDocument();
  });

  it('renders without tracing', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/'traces_sample_rate' => 1\.0,/))
    ).not.toBeInTheDocument();

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/'profiles_sample_rate' => 1\.0,/))
    ).not.toBeInTheDocument();

    // Does not render logs config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/'enable_logs' => true,/))
    ).not.toBeInTheDocument();
  });

  it('renders with logs selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    // Renders logs configuration
    expect(
      screen.getByText(textWithMarkupMatcher(/'enable_logs' => true,/))
    ).toBeInTheDocument();

    // Ensure other config options are not rendered when not selected
    expect(
      screen.queryByText(textWithMarkupMatcher(/'traces_sample_rate' => 1\.0,/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/'profiles_sample_rate' => 1\.0,/))
    ).not.toBeInTheDocument();
  });

  it('renders with all products selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
        ProductSolution.LOGS,
      ],
    });

    // Renders all configuration options
    expect(
      screen.getByText(textWithMarkupMatcher(/'traces_sample_rate' => 1\.0,/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/'profiles_sample_rate' => 1\.0,/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/'enable_logs' => true,/))
    ).toBeInTheDocument();
  });
});
