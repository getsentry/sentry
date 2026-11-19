import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {logs} from './logs';
import {docs} from '.';

describe('dotnet logs onboarding docs', () => {
  it('renders the SentrySdk.Init logs setup', async () => {
    renderWithOnboardingLayout(
      {onboarding: docs.logsOnboarding!},
      {selectedProducts: [ProductSolution.LOGS]}
    );

    expect(
      await screen.findByText(textWithMarkupMatcher(/SentrySdk\.Logger\.LogInfo/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/SentrySdk\.Init\(options =>/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/EnableLogs = true/))
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'logs documentation'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/dotnet/logs/'
    );
  });

  it('renders the UseSentry logs setup when a logger is given', async () => {
    renderWithOnboardingLayout(
      {
        onboarding: logs({
          logger: 'logger',
          sdkPackage: {name: 'Sentry.Maui', registryKey: 'sentry.dotnet.maui'},
          docsGuide: 'maui',
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
      screen.getByText(textWithMarkupMatcher(/takes from dependency injection/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/in the UseSentry callback/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /builder\.UseSentry\(options =>[\s\S]*options\.EnableLogs = true;/
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'logs documentation'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/dotnet/guides/maui/logs/'
    );

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
