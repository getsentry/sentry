import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import TestPreOnboardingPage from 'sentry/views/codecov/tests/preOnboarding';

jest.mock('sentry/utils/regions', () => ({
  getRegionDataFromOrganization: jest.fn(),
}));

const mockGetRegionData = jest.mocked(getRegionDataFromOrganization);

describe('TestPreOnboardingPage', () => {
  const org = OrganizationFixture({
    features: ['codecov-integration'],
  });

  it('displays the US storage alert when organization is not in US region', () => {
    // Mock non-US region
    mockGetRegionData.mockReturnValue({
      name: 'eu',
      displayName: 'European Union (EU)',
      url: 'https://eu.sentry.io',
    });

    render(<TestPreOnboardingPage />, {organization: org});

    // Check that the alert is displayed
    expect(
      screen.getByText(
        'Test Analytics data is stored in the U.S. only. To use this feature, create a new Sentry organization with U.S. data storage.'
      )
    ).toBeInTheDocument();
  });

  it('does not display the US storage alert when organization is in US region', () => {
    // Mock US region
    mockGetRegionData.mockReturnValue({
      name: 'us',
      displayName: 'United States',
      url: 'https://sentry.io',
    });

    render(<TestPreOnboardingPage />, {organization: org});

    expect(
      screen.queryByText(
        'Test Analytics data is stored in the U.S. only. To use this feature, create a new Sentry organization with U.S. data storage.'
      )
    ).not.toBeInTheDocument();
  });

  it('displays the US storage alert when region data is undefined', () => {
    // Mock undefined region data
    mockGetRegionData.mockReturnValue(undefined);

    render(<TestPreOnboardingPage />, {organization: org});

    // Check that the alert is displayed
    expect(
      screen.getByText(
        'Test Analytics data is stored in the U.S. only. To use this feature, create a new Sentry organization with U.S. data storage.'
      )
    ).toBeInTheDocument();
  });
});
