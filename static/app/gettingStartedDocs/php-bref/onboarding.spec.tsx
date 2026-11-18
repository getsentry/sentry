import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {Framework} from './utils';
import {docs} from '.';

describe('bref onboarding docs', () => {
  it('renders the Laravel setup by default', () => {
    renderWithOnboardingLayout(docs);

    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure Bref'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher(/composer require sentry\/sentry-laravel/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/composer require sentry\/sentry-bref/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/SENTRY_LARAVEL_DSN: test-dsn/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/serverless bref:cli --args="sentry:test"/))
    ).toBeInTheDocument();
  });

  it('renders the Symfony setup', () => {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {framework: Framework.SYMFONY},
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/composer require sentry\/sentry-symfony/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/SENTRY_DSN: test-dsn/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(/Sentry\\Bref\\Symfony\\BrefSentryBundle::class/)
      )
    ).toBeInTheDocument();
  });

  it('renders the plain PHP setup', () => {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {framework: Framework.PHP},
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/composer require sentry\/sentry$/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\\Bref\\Psr15\\BrefSentryMiddleware/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/serverless bref:cli/))
    ).not.toBeInTheDocument();
  });

  it('mentions Bref spans only with tracing', () => {
    renderWithOnboardingLayout(docs, {selectedProducts: []});

    expect(
      screen.queryByText(/adds cold starts and AWS SDK calls as spans/)
    ).not.toBeInTheDocument();
  });

  it('enables logs with logs selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/SENTRY_ENABLE_LOGS=true/))
    ).toBeInTheDocument();
  });
});
