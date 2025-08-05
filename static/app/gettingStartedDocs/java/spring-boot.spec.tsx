import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs, {PackageManager} from './spring-boot';

describe('java-spring-boot onboarding docs', function () {
  it('renders gradle docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.java.android.gradle-plugin': {
          version: '1.99.9',
        },
      },
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders SDK version from registry
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/id "io\.sentry\.jvm\.gradle" version "1\.99\.9"/)
      )
    ).toBeInTheDocument();
  });

  it('renders maven docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.java.maven-plugin': {
          version: '3.99.9',
        },
      },
      selectedOptions: {
        packageManager: PackageManager.MAVEN,
      },
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders Plugin version from registry
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          /<artifactId>sentry-maven-plugin<\/artifactId>\s*<version>3\.99\.9<\/version>/m
        )
      )
    ).toBeInTheDocument();
  });

  it('renders logs configuration when logs are selected - Properties format', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Renders logs configuration in Properties format
    expect(
      await screen.findByText(textWithMarkupMatcher(/Enable sending logs to Sentry/))
    ).toBeInTheDocument();

    expect(
      await screen.findByText(textWithMarkupMatcher(/sentry\.logs\.enabled=true/))
    ).toBeInTheDocument();
  });

  it('renders logs configuration when logs are selected - YAML format', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    // Renders logs configuration in YAML format
    expect(
      await screen.findByText(textWithMarkupMatcher(/logs:\s*enabled: true/))
    ).toBeInTheDocument();
  });
});
