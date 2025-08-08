import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CoverageOnboardingPage from 'sentry/views/prevent/coverage/onboarding';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CoverageOnboardingPage', () => {
  it('renders the placeholder content', () => {
    render(<CoverageOnboardingPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    const testContent = screen.getByText('Coverage Onboarding');
    expect(testContent).toBeInTheDocument();
  });
});
