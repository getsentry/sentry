import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('laravel onboarding docs', () => {
  it('renders doc correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders install instructions
    expect(
      screen.getByText(textWithMarkupMatcher(/composer require sentry\/sentry-laravel/))
    ).toBeInTheDocument();
  });

  it('renders without tracing', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/SENTRY_TRACES_SAMPLE_RATE=1\.0/))
    ).not.toBeInTheDocument();

    // Does not render config option
    expect(
      screen.queryByText(textWithMarkupMatcher(/SENTRY_PROFILES_SAMPLE_RATE=1\.0/))
    ).not.toBeInTheDocument();

    // Does not render logs config options
    expect(
      screen.queryByText(textWithMarkupMatcher(/SENTRY_ENABLE_LOGS=true/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/LOG_CHANNEL=stack/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/LOG_STACK=single,sentry_logs/))
    ).not.toBeInTheDocument();
  });

  it('renders with logs selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    // Renders logs environment configuration
    expect(
      screen.getByText(textWithMarkupMatcher(/SENTRY_ENABLE_LOGS=true/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/LOG_CHANNEL=stack/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/LOG_STACK=single,sentry_logs/))
    ).toBeInTheDocument();

    // Renders logging.php configuration instructions
    expect(screen.getByText(textWithMarkupMatcher(/'sentry_logs'/))).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/'driver' => 'sentry_logs'/))
    ).toBeInTheDocument();

    // Renders logs verification examples
    expect(
      screen.getByText(textWithMarkupMatcher(/Log::info\('This is an info message'\)/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/Log::channel\('sentry'\)->error/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\\logger\(\)->info/))
    ).toBeInTheDocument();
  });
});
