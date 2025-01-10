import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from './react-native';

describe('getting started with react-native', function () {
  it('renders errors onboarding docs correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Tracing'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Debug Symbols'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Source Context'})).toBeInTheDocument();
  });

  it('renders performance onboarding docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/Sentry can measure the performance of your app/)
      )
    ).toBeInTheDocument();
  });

  it('renders profiling onboarding docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
      ],
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/profilesSampleRate/))
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/React Native Profiling is available/)
      )
    ).toBeInTheDocument();
  });
});
