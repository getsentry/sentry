import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('go onboarding docs', () => {
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

    const elements = await screen.findAllByText(
      textWithMarkupMatcher(/TracesSampleRate/)
    );
    for (const element of elements) {
      expect(element).toBeInTheDocument();
    }
  });

  it('renders logs onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {selectedProducts: [ProductSolution.LOGS]});

    expect(await screen.findByText('Logging Integrations')).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/EnableLogs/))
    ).not.toBeInTheDocument();
  });

  it('renders performance and logs onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
    });

    const traceElements = await screen.findAllByText(
      textWithMarkupMatcher(/TracesSampleRate/)
    );
    for (const element of traceElements) {
      expect(element).toBeInTheDocument();
    }

    expect(await screen.findByText('Logging Integrations')).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/EnableLogs/))
    ).not.toBeInTheDocument();
  });

  it('renders the logs onboarding without EnableLogs', async () => {
    renderWithOnboardingLayout(
      {onboarding: docs.logsOnboarding!},
      {selectedProducts: [ProductSolution.LOGS]}
    );

    expect(
      await screen.findByText(textWithMarkupMatcher(/sentry\.NewLogger\(ctx\)/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/EnableLogs/))
    ).not.toBeInTheDocument();
  });
});
