import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import docs, {PackageManager, SpringVersion} from './spring';

describe('GettingStartedWithSpring', function () {
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

  it('renders spring 5 doc correctly', async function () {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.java.android.gradle-plugin': {
          version: '1.99.9',
        },
      },
      selectedOptions: {
        springVersion: SpringVersion.V5,
      },
    });
    // Uses Sentry Spring import
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/import io.sentry.spring.EnableSentry/)
      )
    ).toBeInTheDocument();
  });

  it('renders spring 6 doc correctly', async function () {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.java.android.gradle-plugin': {
          version: '1.99.9',
        },
      },
      selectedOptions: {
        springVersion: SpringVersion.V6,
      },
    });
    // Uses Sentry Spring import
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/import io.sentry.spring.jakarta.EnableSentry/)
      )
    ).toBeInTheDocument();
  });
});
