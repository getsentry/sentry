import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import docs, {
  InstallationMode,
} from 'sentry/gettingStartedDocs/react-native/react-native';

describe('getting started with react-native', function () {
  it('renders manual installation docs correctly', function () {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    // For manual install, we should see "Install SDK Package" instead of "Install"
    expect(
      screen.getByRole('heading', {name: 'Install SDK Package'})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  it('renders auto installation docs correctly', function () {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {
        installationMode: InstallationMode.AUTO,
      },
    });

    // For auto install, we should see "Install" and no configure/verify sections
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Configure SDK'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Verify'})).not.toBeInTheDocument();
  });

  it('renders errors onboarding docs correctly', function () {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Tracing'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Debug Symbols'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Source Context'})).toBeInTheDocument();
  });

  it('renders performance onboarding docs correctly', function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).toBeInTheDocument();
  });

  it('renders profiling onboarding docs correctly', function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
      ],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/profilesSampleRate/))
    ).toBeInTheDocument();
  });
});
