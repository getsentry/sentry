import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from './flutter';

describe('flutter onboarding docs', function () {
  it('renders errors onboarding docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
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
      await screen.findByText(textWithMarkupMatcher(/sentry_flutter: \^1\.99\.9/))
    ).toBeInTheDocument();
  });

  it('renders performance onboarding docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dart.flutter': {
          version: '1.99.9',
        },
      },
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/options.tracesSampleRate/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          /You'll be able to monitor the performance of your app using the SDK./
        )
      )
    ).toBeInTheDocument();
  });

  it('renders profiling onboarding docs correctly', async function () {
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
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/options.profilesSampleRate/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/Flutter Profiling alpha is available/)
      )
    ).toBeInTheDocument();
  });
});
