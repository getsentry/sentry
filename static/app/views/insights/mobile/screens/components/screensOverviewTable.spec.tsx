import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ScreensOverviewTable from 'sentry/views/insights/mobile/screens/components/screensOverviewTable';

jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/views/insights/common/utils/useModuleURL');
jest.mock('sentry/utils/usePageFilters');

describe('ScreensOverviewTable', () => {
  const organization = OrganizationFixture({
    features: ['insights-addon-modules', 'insights-mobile-screens-module'],
  });
  const project = ProjectFixture();

  const location = {
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/performance/mobile/mobile-screens',
    query: {
      project: project.id,
    },
    search: '',
    state: undefined,
  } as Location;

  jest.mocked(useOrganization).mockReturnValue(organization);
  jest.mocked(useLocation).mockReturnValue(location);
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

  const mockEventView = EventView.fromLocation(location);

  const mockData = {
    data: [
      {
        id: '1',
        transaction: 'Screen 01',
        'avg(mobile.slow_frames)': 12,
        'avg(mobile.frozen_frames)': 23,
        'count()': 45,
      },
    ],
    meta: {
      fields: [],
    },
  };

  it('renders columns', async () => {
    render(
      <ScreensOverviewTable
        data={mockData}
        eventView={mockEventView}
        isLoading={false}
        pageLinks=""
      />
    );

    // headers
    expect(await screen.findByText('Screen')).toBeInTheDocument();
    expect(await screen.findByText('Slow Frames')).toBeInTheDocument();
    expect(await screen.findByText('Frozen Frames')).toBeInTheDocument();

    expect(await screen.findByText('Screen 01')).toBeInTheDocument();
    // slow frames
    expect(await screen.findByText('12')).toBeInTheDocument();
    // frozen frames
    expect(await screen.findByText('23')).toBeInTheDocument();
    // count
    expect(await screen.findByText('45')).toBeInTheDocument();
  });
});
