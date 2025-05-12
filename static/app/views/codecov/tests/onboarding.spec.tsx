import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TestAnalyticsOnboardingPage from 'sentry/views/codecov/tests/onboarding';

const COVERAGE_FEATURE = 'codecov-ui';

describe('TestAnalyticsOnboardingPage', () => {
  it('renders the placeholder content', () => {
    render(<TestAnalyticsOnboardingPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    const testContent = screen.getByText('Test Analytics Onboarding');
    expect(testContent).toBeInTheDocument();
  });
});
