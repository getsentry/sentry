import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {metrics} from './metrics';
import {docs} from '.';

describe('metrics', () => {
  it('dotnet metrics onboarding docs', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.METRICS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/SentrySdk\.Metrics\.EmitCounter/))
    ).toBeInTheDocument();
  });

  it('installs the given package and leaves out SentrySdk.Init for a host', async () => {
    renderWithOnboardingLayout(
      {
        onboarding: metrics({
          hostInitializesSdk: true,
          sdkPackage: {name: 'Sentry.Maui', registryKey: 'sentry.dotnet.maui'},
        }),
      },
      {
        releaseRegistry: {'sentry.dotnet.maui': {version: '1.99.9'}},
        selectedProducts: [ProductSolution.METRICS],
      }
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher(/Install-Package Sentry\.Maui -Version 1\.99\.9/)
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher(/SentrySdk\.Metrics\.EmitCounter/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/SentrySdk\.Init\(/))
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: '.NET Core CLI'}));
    expect(
      screen.getByText(
        textWithMarkupMatcher(/dotnet add package Sentry\.Maui -v 1\.99\.9/)
      )
    ).toBeInTheDocument();
  });

  it('does not render metrics configuration when metrics is not enabled', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/SentrySdk\.Metrics\.EmitCounter/))
    ).not.toBeInTheDocument();
  });
});
