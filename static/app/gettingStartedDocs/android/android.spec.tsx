import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs, {InstallationMode} from './android';

describe('java-spring-boot onboarding docs', () => {
  it('renders gradle docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.java.android.gradle-plugin': {
          version: '1.99.9',
        },
      },
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders SDK version from registry
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/id "io\.sentry\.android\.gradle" version "1\.99\.9"/)
      )
    ).toBeInTheDocument();
  });

  it('renders wizard docs', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.java.spring-boot.jakarta': {
          version: '2.99.9',
        },
        'sentry.java.mavenplugin': {
          version: '3.99.9',
        },
      },
      selectedOptions: {
        installationMode: InstallationMode.AUTO,
      },
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Configure SDK'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Verify'})).not.toBeInTheDocument();

    // Renders SDK version from registry
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          /Add Sentry automatically to your app with the Sentry wizard/m
        )
      )
    ).toBeInTheDocument();
  });

  it('renders logs configuration for manual installation when logs are selected', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.java.android.gradle-plugin': {
          version: '1.99.9',
        },
      },
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
      selectedProducts: [ProductSolution.LOGS],
    });

    // Should include logs metadata in configuration
    expect(
      await screen.findByText(textWithMarkupMatcher(/io\.sentry\.logs\.enabled.*true/))
    ).toBeInTheDocument();

    // Should include logging integrations next step
    expect(await screen.findByText('Logging Integrations')).toBeInTheDocument();
  });

  it('renders logs configuration for auto installation when logs are selected', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.java.android.gradle-plugin': {
          version: '1.99.9',
        },
      },
      selectedOptions: {
        installationMode: InstallationMode.AUTO,
      },
      selectedProducts: [ProductSolution.LOGS],
    });

    // Should include logging integrations next step even in auto mode
    expect(await screen.findByText('Logging Integrations')).toBeInTheDocument();
  });
});
