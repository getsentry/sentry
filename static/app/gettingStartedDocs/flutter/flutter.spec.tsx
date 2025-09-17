import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs, {InstallationMode} from './flutter';

describe('flutter onboarding docs', () => {
  it('renders manual installation docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
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
      await screen.findByText(textWithMarkupMatcher(/sentry_flutter: \^1\.99\.9/))
    ).toBeInTheDocument();
  });

  it('renders wizard docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
          version: '1.99.9',
        },
      },
      selectedOptions: {
        installationMode: InstallationMode.AUTO,
      },
    });

    // Renders install heading only
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Configure SDK'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Verify'})).not.toBeInTheDocument();

    // Renders wizard text
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          /Add Sentry automatically to your app with the Sentry wizard/
        )
      )
    ).toBeInTheDocument();
  });

  it('renders performance onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
          version: '1.99.9',
        },
      },
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/options.tracesSampleRate/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(textWithMarkupMatcher(/options\.tracesSampleRate = 1\.0/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          /You'll be able to monitor the performance of your app using the SDK./
        )
      )
    ).toBeInTheDocument();
  });

  it('renders profiling onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
          version: '1.99.9',
        },
      },
      selectedProducts: [
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
      ],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/options.profilesSampleRate/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(textWithMarkupMatcher(/options\.profilesSampleRate = 1\.0/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/Flutter Profiling alpha is available/)
      )
    ).toBeInTheDocument();
  });

  it('renders replay onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
          version: '1.99.9',
        },
      },
      selectedProducts: [
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
        ProductSolution.SESSION_REPLAY,
      ],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      await screen.findByText(
        textWithMarkupMatcher(/options\.replay\.sessionSampleRate = 0\.1/)
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/options\.replay\.onErrorSampleRate = 1\.0/)
      )
    ).toBeInTheDocument();
  });

  it('renders logs configuration for manual installation when logs are selected', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
          version: '1.99.9',
        },
      },
      selectedProducts: [ProductSolution.LOGS],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    // Should include logs configuration
    expect(
      await screen.findByText(textWithMarkupMatcher(/options\.enableLogs = true/))
    ).toBeInTheDocument();

    // Should include a log call in the verify snippet
    expect(
      await screen.findByText(textWithMarkupMatcher(/Sentry\.logger\.info/))
    ).toBeInTheDocument();

    // Should include logging next step
    expect(await screen.findByText('Structured Logs')).toBeInTheDocument();
  });

  it('renders logs configuration for auto installation when logs are selected', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
          version: '1.99.9',
        },
      },
      selectedProducts: [ProductSolution.LOGS],
      selectedOptions: {
        installationMode: InstallationMode.AUTO,
      },
    });

    // Should include logging next step even in auto mode
    expect(await screen.findByText('Structured Logs')).toBeInTheDocument();
  });
});
