import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Project} from 'sentry/types/project';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {UIScreens} from 'sentry/views/insights/mobile/ui/components/uiScreens';
import {Referrer} from 'sentry/views/insights/mobile/ui/referrers';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/views/insights/common/queries/useReleases');

jest.mocked(useReleaseSelection).mockReturnValue({
  primaryRelease: 'com.example.vu.android@2.10.5',
  isLoading: false,
  secondaryRelease: 'com.example.vu.android@2.10.3+42',
});

const createMockTablePayload = ({
  transaction,
  project,
}: {
  project: Project;
  transaction: string;
}) => ({
  'avg_compare(mobile.frames_delay,release,com.example.vu.android@2.10.5,com.example.vu.android@2.10.3+42)':
    null,
  'avg_if(mobile.frames_delay,release,com.example.vu.android@2.10.5)': 0,
  'avg_if(mobile.frames_delay,release,com.example.vu.android@2.10.3+42)': 0.259326119,
  'division_if(mobile.frozen_frames,mobile.total_frames,release,com.example.vu.android@2.10.5)': 0,
  'division_if(mobile.frozen_frames,mobile.total_frames,release,com.example.vu.android@2.10.3+42)': 0,
  'division_if(mobile.slow_frames,mobile.total_frames,release,com.example.vu.android@2.10.5)': 0,
  'division_if(mobile.slow_frames,mobile.total_frames,release,com.example.vu.android@2.10.3+42)': 2,
  'project.id': project.id,
  transaction,
});

describe('Performance Mobile UI Screens', () => {
  const project = ProjectFixture({platform: 'apple-ios'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();

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
  });

  it('queries for the correct table data', async () => {
    const tableRequestMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
      match: [MockApiClient.matchQuery({referrer: Referrer.OVERVIEW_SCREENS_TABLE})],
    });

    render(<UIScreens />);

    expect(await screen.findByRole('columnheader', {name: 'Screen'})).toBeInTheDocument();
    [
      'Slow (R1)',
      'Slow (R2)',
      'Frozen (R1)',
      'Frozen (R2)',
      'Delay (R1)',
      'Delay (R2)',
    ].forEach(header => {
      expect(screen.getByRole('columnheader', {name: header})).toBeInTheDocument();
    });

    expect(tableRequestMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: [
            'project.id',
            'transaction',
            'division_if(mobile.slow_frames,mobile.total_frames,release,com.example.vu.android@2.10.5)',
            'division_if(mobile.slow_frames,mobile.total_frames,release,com.example.vu.android@2.10.3+42)',
            'division_if(mobile.frozen_frames,mobile.total_frames,release,com.example.vu.android@2.10.5)',
            'division_if(mobile.frozen_frames,mobile.total_frames,release,com.example.vu.android@2.10.3+42)',
            'avg_if(mobile.frames_delay,release,com.example.vu.android@2.10.5)',
            'avg_if(mobile.frames_delay,release,com.example.vu.android@2.10.3+42)',
            'avg_compare(mobile.frames_delay,release,com.example.vu.android@2.10.5,com.example.vu.android@2.10.3+42)',
          ],
        }),
      })
    );
  });

  it('queries for the correct chart data using the top transactions', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          createMockTablePayload({transaction: 'top 1', project}),
          createMockTablePayload({transaction: 'top 2', project}),
          createMockTablePayload({transaction: 'top 3', project}),
          createMockTablePayload({transaction: 'top 4', project}),
          createMockTablePayload({transaction: 'top 5', project}),
          createMockTablePayload({transaction: 'top 6', project}), // excluded
        ],
      },
      match: [MockApiClient.matchQuery({referrer: Referrer.OVERVIEW_SCREENS_TABLE})],
    });

    const chartDataRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
      match: [MockApiClient.matchQuery({referrer: Referrer.MOBILE_UI_BAR_CHART})],
    });

    render(<UIScreens />);

    await screen.findByText('top 1');

    screen.getByText('Top 5 Screen Slow Frames');
    screen.getByText('Top 5 Screen Frozen Frames');
    screen.getByText('Top 5 Screen Frames Delay');

    expect(chartDataRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: [
            'transaction',
            'release',
            'avg(mobile.slow_frames)',
            'avg(mobile.frozen_frames)',
            'avg(mobile.frames_delay)',
          ],
          query:
            '( release:com.example.vu.android@2.10.5 OR release:com.example.vu.android@2.10.3+42 ) transaction:["top 1","top 2","top 3","top 4","top 5"]',
        }),
      })
    );
  });
});
