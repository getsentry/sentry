import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {logs} from './logs';
import {docs} from '.';

describe('dotnet logs onboarding docs', () => {
  it('renders the SentrySdk.Init logs setup', async () => {
    renderWithOnboardingLayout(
      {onboarding: logs()},
      {selectedProducts: [ProductSolution.LOGS]}
    );

    expect(
      await screen.findByText(textWithMarkupMatcher(/SentrySdk\.Logger\.LogInfo/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/EnableLogs/))
    ).not.toBeInTheDocument();
  });

  it('renders the UseSentry logs setup when a logger is given', async () => {
    renderWithOnboardingLayout(
      {onboarding: logs({logger: 'logger'})},
      {selectedProducts: [ProductSolution.LOGS]}
    );

    expect(
      await screen.findByText(textWithMarkupMatcher(/logger\.LogInformation/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/set EnableLogs to true/))
    ).toBeInTheDocument();
  });

  it('does not render logs configuration when logs is not enabled', async () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    expect(await screen.findByRole('heading', {name: 'Install'})).toBeInTheDocument();

    expect(
      screen.queryByText(textWithMarkupMatcher(/SentrySdk\.Logger\.LogInfo/))
    ).not.toBeInTheDocument();
  });
});
