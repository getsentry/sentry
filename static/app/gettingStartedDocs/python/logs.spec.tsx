import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('python logs onboarding docs', () => {
  it('renders logs onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {selectedProducts: [ProductSolution.LOGS]});

    expect(
      await screen.findByText(textWithMarkupMatcher(/LoggingIntegration\(\),/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/sentry_sdk\.logger\.info/))
    ).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher(/import logging/))).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(/Logs require Python SDK version 2\.68\.0 or higher/)
      )
    ).toBeInTheDocument();
  });

  it('does not render logs configuration when logs is not enabled', async () => {
    renderWithOnboardingLayout(docs, {selectedProducts: []});

    expect(await screen.findByRole('heading', {name: /Configure/})).toBeInTheDocument();

    expect(
      screen.queryByText(textWithMarkupMatcher(/LoggingIntegration\(\),/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/sentry_sdk\.logger\.info/))
    ).not.toBeInTheDocument();
  });
});
