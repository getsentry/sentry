import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen, userEvent} from 'sentry-test/reactTestingLibrary';
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
      screen.queryByText(textWithMarkupMatcher(/EnableLogs = true/))
    ).not.toBeInTheDocument();
  });

  it('renders the UseSentry logs setup when a logger is given', async () => {
    renderWithOnboardingLayout(
      {
        onboarding: logs({
          logger: 'logger',
          sdkPackage: {name: 'Sentry.Maui', registryKey: 'sentry.dotnet.maui'},
        }),
      },
      {
        releaseRegistry: {'sentry.dotnet.maui': {version: '1.99.9'}},
        selectedProducts: [ProductSolution.LOGS],
      }
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(/Install-Package Sentry\.Maui -Version 1\.99\.9/)
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/logger\.LogInformation/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/logger\.LogWarning/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/the options you pass to UseSentry/))
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: '.NET Core CLI'}));
    expect(
      screen.getByText(
        textWithMarkupMatcher(/dotnet add package Sentry\.Maui -v 1\.99\.9/)
      )
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
