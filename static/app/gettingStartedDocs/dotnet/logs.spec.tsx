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

    expect(
      await screen.findByText(textWithMarkupMatcher(/options\.EnableLogs = true/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/SentrySdk\.Logger\.LogInfo/))
    ).toBeInTheDocument();
  });

  it('does not render logs configuration when logs is not enabled', async () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    expect(await screen.findByRole('heading', {name: 'Install'})).toBeInTheDocument();

    expect(
      screen.queryByText(textWithMarkupMatcher(/options\.EnableLogs = true/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/SentrySdk\.Logger\.LogInfo/))
    ).not.toBeInTheDocument();
  });
});
