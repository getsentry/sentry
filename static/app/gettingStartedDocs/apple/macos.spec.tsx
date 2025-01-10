import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from './macos';

describe('apple-macos onboarding docs', function () {
  it('renders docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.cocoa': {
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
        textWithMarkupMatcher(
          /\.package\(url: "https:\/\/github.com\/getsentry\/sentry-cocoa", from: "1\.99\.9"\),/
        )
      )
    ).toBeInTheDocument();
  });

  it('renders performance onboarding docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
    });

    expect(
      await screen.findAllByText(textWithMarkupMatcher(/options.tracesSampleRate/))
    ).toHaveLength(2);
  });

  it('renders transaction profiling', async function () {
    renderWithOnboardingLayout(docs);

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
      {},
      {
        organization,
      }
    );

    // Does not render transaction profiling config
    expect(
      screen.queryByText(textWithMarkupMatcher(/options.profilesSampleRate/))
    ).not.toBeInTheDocument();

    // Does render continuous profiling config
    const startMatches = screen.queryAllByText(
      textWithMarkupMatcher(/SentrySDK.startProfiler\(\)/)
    );
    expect(startMatches.length).toBeGreaterThan(0);
    startMatches.forEach(match => expect(match).toBeInTheDocument());

    const stopMatches = screen.queryAllByText(
      textWithMarkupMatcher(/SentrySDK.stopProfiler\(\)/)
    );
    expect(stopMatches.length).toBeGreaterThan(0);
    stopMatches.forEach(match => expect(match).toBeInTheDocument());
  });
});
