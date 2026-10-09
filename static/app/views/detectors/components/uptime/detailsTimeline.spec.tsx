import {UptimeDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import {DetailsTimeline} from 'sentry/views/detectors/components/uptime/detailsTimeline';
import {
  CheckStatus,
  type CheckStatusBucket,
} from 'sentry/views/detectors/components/uptime/types';

jest.mock('sentry/components/checkInTimeline/hooks/useTimeWindowConfig');

const startTime = new Date('2025-01-01T11:00:00Z');

jest
  .mocked(useTimeWindowConfig)
  .mockReturnValue(
    getConfigFromTimeRange(
      startTime,
      new Date(startTime.getTime() + 1000 * 60 * 60),
      1000,
      'UTC'
    )
  );

describe('DetailsTimeline', () => {
  const organization = OrganizationFixture();
  const detector = UptimeDetectorFixture({id: '3'});
  const stats: CheckStatusBucket[] = [
    [
      startTime.getTime() / 1000,
      {
        [CheckStatus.SUCCESS]: 1,
        [CheckStatus.FAILURE]: 0,
        [CheckStatus.FAILURE_INCIDENT]: 0,
        [CheckStatus.MISSED_WINDOW]: 0,
      },
    ],
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-stats/`,
      query: {uptimeDetectorId: [detector.id]},
      body: {[detector.id]: stats},
    });
  });

  it('renders the time axis and a placeholder row when stats are loading', () => {
    render(<DetailsTimeline uptimeDetector={detector} onStatsLoaded={jest.fn()} />, {
      organization,
    });

    const table = screen.getByRole('table', {name: 'Uptime check timeline'});
    expect(
      within(table).getByRole('columnheader', {name: 'Timeline'})
    ).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Jan 1, 2025 11:00 AM UTC')).toBeInTheDocument();
    expect(within(table).getByTestId('check-in-placeholder')).toBeInTheDocument();
  });

  it('renders the check timeline and reports the stats when they load', async () => {
    const onStatsLoaded = jest.fn();

    render(<DetailsTimeline uptimeDetector={detector} onStatsLoaded={onStatsLoaded} />, {
      organization,
    });

    const table = screen.getByRole('table', {name: 'Uptime check timeline'});
    expect(await within(table).findByRole('figure')).toBeInTheDocument();
    expect(within(table).getAllByTestId('monitor-checkin-tick')).toHaveLength(1);
    expect(within(table).queryByTestId('check-in-placeholder')).not.toBeInTheDocument();
    expect(onStatsLoaded).toHaveBeenCalledWith(stats);
  });
});
