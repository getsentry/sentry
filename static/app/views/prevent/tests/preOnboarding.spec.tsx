import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import TestsPreOnboardingPage from 'sentry/views/prevent/tests/preOnboarding';

jest.mock('sentry/utils/regions', () => ({
  getRegionDataFromOrganization: jest.fn(),
}));

const mockGetRegionData = jest.mocked(getRegionDataFromOrganization);

describe('TestsPreOnboardingPage', () => {
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

    render(<TestsPreOnboardingPage />, {organization: org});

    // Check that the alert is displayed
    expect(
      screen.getByText(
        'Test Analytics data is stored in the U.S. only and is not available in the EU. EU region support is coming soon.'
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

    render(<TestsPreOnboardingPage />, {organization: org});

    expect(
      screen.queryByText(
        'Test Analytics data is stored in the U.S. only and is not available in the EU. EU region support is coming soon.'
      )
    ).not.toBeInTheDocument();
  });

  it('displays the US storage alert when region data is undefined', () => {
    // Mock undefined region data
    mockGetRegionData.mockReturnValue(undefined);

    render(<TestsPreOnboardingPage />, {organization: org});

    // Check that the alert is displayed
    expect(
      screen.getByText(
        'Test Analytics data is stored in the U.S. only and is not available in the EU. EU region support is coming soon.'
      )
    ).toBeInTheDocument();
  });

  it('displays the feature is only allowed in US messaging when isUSstorage is false', () => {
    mockGetRegionData.mockReturnValue({
      name: 'eu',
      displayName: 'European Union (EU)',
      url: 'https://eu.sentry.io',
    });

    render(<TestsPreOnboardingPage />, {organization: org});

    expect(
      screen.getByText('Keep Test Problems From Slowing You Down')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Test Analytics data is stored in the U.S. only and is not available in the EU. EU region support is coming soon.'
      )
    ).toBeInTheDocument();
  });
});
