import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

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
});
