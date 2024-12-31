import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import docs, {InstallationMode} from './javascript';

describe('javascript onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Upload Source Maps'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes import statement
    expect(
      screen.getByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/browser"/)
      )
    ).toBeInTheDocument();
  });

  it('displays sample rates by default', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysSessionSampleRate/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysOnErrorSampleRate/))
    ).toBeInTheDocument();
  });

  it('enables performance setting the tracesSampleRate to 1', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('enables replay by setting replay samplerates', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/replaysSessionSampleRate: 0\.1/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysOnErrorSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('enables profiling by setting profiling sample rates', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry.browserProfilingIntegration\(\)/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('renders Loader Script by default', function () {
    renderWithOnboardingLayout(docs);

    expect(screen.getByRole('radio', {name: 'Loader Script'})).toBeChecked();

    expect(
      screen.getByRole('heading', {name: 'Configure SDK (Optional)'})
    ).toBeInTheDocument();
  });

  it('renders package manager installation', function () {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(screen.getByRole('radio', {name: 'Npm/Yarn'})).toBeChecked();

    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
  });
});
