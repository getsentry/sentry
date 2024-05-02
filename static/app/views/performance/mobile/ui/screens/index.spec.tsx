import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {Referrer} from 'sentry/views/performance/mobile/ui/referrers';
import {UIScreens} from 'sentry/views/performance/mobile/ui/screens';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/views/starfish/queries/useReleases');

jest.mocked(useReleaseSelection).mockReturnValue({
  primaryRelease: 'com.example.vu.android@2.10.5',
  isLoading: false,
  secondaryRelease: 'com.example.vu.android@2.10.3+42',
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
    expect(screen.getAllByRole('columnheader', {name: 'Change'})).toHaveLength(3);

    expect(tableRequestMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: [
            'project.id',
            'transaction',
            'avg_if(mobile.slow_frames,release,com.example.vu.android@2.10.5)',
            'avg_if(mobile.slow_frames,release,com.example.vu.android@2.10.3+42)',
            'avg_if(mobile.frozen_frames,release,com.example.vu.android@2.10.5)',
            'avg_if(mobile.frozen_frames,release,com.example.vu.android@2.10.3+42)',
            'avg_if(mobile.frames_delay,release,com.example.vu.android@2.10.5)',
            'avg_if(mobile.frames_delay,release,com.example.vu.android@2.10.3+42)',
            'avg_compare(mobile.slow_frames,release,com.example.vu.android@2.10.5,com.example.vu.android@2.10.3+42)',
            'avg_compare(mobile.frozen_frames,release,com.example.vu.android@2.10.5,com.example.vu.android@2.10.3+42)',
            'avg_compare(mobile.frames_delay,release,com.example.vu.android@2.10.5,com.example.vu.android@2.10.3+42)',
          ],
        }),
      })
    );
  });
});
