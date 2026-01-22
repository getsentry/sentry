import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('dotnet logs onboarding docs', () => {
  it('renders logs onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.LOGS],
    });

    // Verify logs configuration is shown
    expect(
      await screen.findByText(textWithMarkupMatcher(/options\.EnableLogs/))
    ).toBeInTheDocument();

    // Verify logs verification code is shown
    expect(
      await screen.findByText(textWithMarkupMatcher(/SentrySdk\.Logger\.LogInfo/))
    ).toBeInTheDocument();
  });
});
