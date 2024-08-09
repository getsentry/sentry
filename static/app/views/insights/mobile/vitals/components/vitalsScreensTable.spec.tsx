import {render, screen} from '@testing-library/react';
import type {Location} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import VitalsScreensTable from 'sentry/views/insights/mobile/vitals/components/vitalsScreensTable';

jest.mock('sentry/utils/useOrganization');
jest.mock('sentry/utils/useLocation');
jest.mock('sentry/views/insights/common/utils/useModuleURL');
jest.mock('sentry/utils/usePageFilters');

describe('VitalsScreensTable', () => {
  const organization = OrganizationFixture({
    features: ['insights-addon-modules', 'insights-mobile-vitals-module'],
  });
  const project = ProjectFixture();

  const location = {
    action: 'PUSH',
    hash: '',
    key: '',
    pathname: '/organizations/org-slug/performance/mobile/vitals',
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
        'avg(mobile.frames_delay)': 34,
        'count()': 45,
      },
    ],
    meta: {
      fields: [],
    },
  };

  it('renders columns', async () => {
    render(
      <ThemeAndStyleProvider>
        <VitalsScreensTable
          data={mockData}
          eventView={mockEventView}
          isLoading={false}
          pageLinks=""
        />
      </ThemeAndStyleProvider>
    );

    // headers
    expect(await screen.findByText('Screen')).toBeInTheDocument();
    expect(await screen.findByText('Slow Frames')).toBeInTheDocument();
    expect(await screen.findByText('Frozen Frames')).toBeInTheDocument();
    expect(await screen.findByText('Frame Delay')).toBeInTheDocument();

    // content
    expect(await screen.findByText('Screen 01')).toBeInTheDocument();
    // slow frames
    expect(await screen.findByText('12')).toBeInTheDocument();
    // frozen frames
    expect(await screen.findByText('23')).toBeInTheDocument();
    // frames delay
    expect(await screen.findByText('34.00s')).toBeInTheDocument();
    // count
    expect(await screen.findByText('45')).toBeInTheDocument();
  });
});
