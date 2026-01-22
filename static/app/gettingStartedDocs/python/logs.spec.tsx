import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('python logs onboarding docs', () => {
  it('renders logs onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.LOGS],
    });

    // Verify logs configuration is shown
    expect(
      screen.getByText(textWithMarkupMatcher(/enable_logs=True/))
    ).toBeInTheDocument();

    // Verify logs verification code is shown
    expect(
      screen.getByText(textWithMarkupMatcher(/sentry_sdk\.logger\.info/))
    ).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher(/import logging/))).toBeInTheDocument();
  });
});
