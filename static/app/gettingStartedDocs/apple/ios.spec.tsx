import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import docs, {InstallationMode} from './ios';

describe('apple-ios onboarding docs', function () {
  it('renders docs correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Experimental Features'})
    ).toBeInTheDocument();
  });

  it('renders performance onboarding docs correctly', async function () {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
      selectedOptions: {
        installationMode: InstallationMode.MANUAL,
      },
    });

    expect(
      await screen.findAllByText(textWithMarkupMatcher(/options.tracesSampleRate/))
    ).toHaveLength(2);
  });

  it('renders profiling onboarding docs correctly', async function () {
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
      await screen.findAllByText(textWithMarkupMatcher(/options.profilesSampleRate/))
    ).toHaveLength(2);
  });
});
