import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {VitalScreens} from 'sentry/views/insights/mobile/vitals/components/vitalScreens';

jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/views/insights/mobile/common/queries/useCrossPlatformProject');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');

describe('VitalScreens', () => {
  const organization = OrganizationFixture({
    features: ['insights-addon-modules', 'insights-mobile-vitals-module'],
  });
  const project = ProjectFixture();

  jest.mocked(useLocation).mockReturnValue({
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/performance/mobile/vitals',
    query: {
      project: project.id,
    },
    search: '',
    state: undefined,
  } as Location);

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [parseInt(project.id, 10)],
    },
  });

  jest.mocked(useCrossPlatformProject).mockReturnValue({
    project: project,
    isProjectCrossPlatform: true,
    selectedPlatform: 'Android',
  });

  jest.mocked(useOrganization).mockReturnValue(organization);

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
  });

  it('renders search bar and table', async () => {
    render(<VitalScreens />, {organization});

    expect(await screen.findByPlaceholderText('Search for Screen')).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});
