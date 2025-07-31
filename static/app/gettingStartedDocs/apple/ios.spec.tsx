import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs, {InstallationMode} from './ios';

describe('apple-ios onboarding docs', function () {
  it('renders docs correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  it('renders swift onboarding docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL_SWIFT,
      },
    });

    expect(
      await screen.findAllByText(
        textWithMarkupMatcher(/throw MyCustomError\.myFirstIssue/)
      )
    ).toHaveLength(1);
  });

  it('renders performance onboarding docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL_SWIFT,
      },
    });

    expect(
      await screen.findAllByText(textWithMarkupMatcher(/options.tracesSampleRate/))
    ).toHaveLength(2);
  });

  it('renders transaction profiling', async function () {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {
        installationMode: InstallationMode.MANUAL_SWIFT,
      },
    });

    // Does not render continuous profiling config
    expect(
      screen.queryByText(textWithMarkupMatcher(/SentrySDK.startProfiler\(\)/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/SentrySDK.stopProfiler\(\)/))
    ).not.toBeInTheDocument();

    // Does render transaction profiling config
    expect(
      await screen.findAllByText(textWithMarkupMatcher(/options.profilesSampleRate/))
    ).toHaveLength(2);
  });

  it('renders continuous profiling', function () {
    const organization = OrganizationFixture({
      features: ['continuous-profiling'],
    });

    renderWithOnboardingLayout(
      docs,
      {
        selectedOptions: {
          installationMode: InstallationMode.MANUAL_SWIFT,
        },
      },
      {
        organization,
      }
    );

    // Does not render transaction profiling config
    expect(
      screen.queryByText(textWithMarkupMatcher(/options.profilesSampleRate/))
    ).not.toBeInTheDocument();

    // Does render continuous profiling config
    const sessionSampleRateElements = screen.queryAllByText(
      textWithMarkupMatcher(/\$0\.sessionSampleRate = 1\.0/)
    );
    expect(sessionSampleRateElements).toHaveLength(2);
    sessionSampleRateElements.forEach(element => expect(element).toBeInTheDocument());

    const lifecycleElements = screen.queryAllByText(
      textWithMarkupMatcher(/\$0\.lifecycle = \.trace/)
    );
    expect(lifecycleElements).toHaveLength(2);
    lifecycleElements.forEach(element => expect(element).toBeInTheDocument());
  });

  it('renders manual objective-c docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL_OBJECTIVE_C,
      },
    });

    expect(
      await screen.findAllByText(textWithMarkupMatcher(/@import Sentry;/))
    ).toHaveLength(1);
  });
});
