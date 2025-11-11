import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

<<<<<<< HEAD:static/app/gettingStartedDocs/python/sanic.spec.tsx
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from './sanic';
=======
import docs from '.';
>>>>>>> master:static/app/gettingStartedDocs/python/sanic/onboarding.spec.tsx

describe('sanic onboarding docs', () => {
  it('renders doc correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  it('renders metrics configuration when metrics are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.METRICS],
    });

    // Renders metrics verification steps
    expect(
      screen.getByText('You can send metrics to Sentry using the Sentry metrics APIs:')
    ).toBeInTheDocument();
  });

  it('renders without metrics configuration when metrics are not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    // Does not render metrics verification steps
    expect(
      screen.queryByText('You can send metrics to Sentry using the Sentry metrics APIs:')
    ).not.toBeInTheDocument();
  });
});
