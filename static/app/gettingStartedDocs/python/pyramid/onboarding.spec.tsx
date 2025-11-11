import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('aiohttp onboarding docs', () => {
  it('renders doc correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  it('renders with metrics', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.METRICS],
    });

    // Renders metrics verification steps
    expect(
      screen.getByText(
        'Send test metrics from your app to verify metrics are arriving in Sentry.'
      )
    ).toBeInTheDocument();
  });

  it('renders without metrics', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Does not render metrics verification steps
    expect(
      screen.queryByText(
        'Send test metrics from your app to verify metrics are arriving in Sentry.'
      )
    ).not.toBeInTheDocument();
  });
});
