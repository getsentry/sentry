import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MockTimelineVisualization} from 'sentry/views/insights/crons/components/mockTimelineVisualization';

jest.mock('sentry/utils/useDimensions', () => ({
  useDimensions: () => ({width: 800}),
}));

describe('MockTimelineVisualizer', () => {
  const {organization} = initializeOrg();

  it('should request and display mock data', async () => {
    const schedule = {
      cronSchedule: '0 * * * *',
      scheduleType: 'crontab',
    };
    const data = [
      new Date('2023/11/20'),
      new Date('2023/11/21'),
      new Date('2023/11/22'),
      new Date('2023/11/23'),
      new Date('2023/11/24'),
      new Date('2023/11/25'),
      new Date('2023/11/26'),
      new Date('2023/11/27'),
      new Date('2023/11/28'),
    ].map(date => date.getTime() / 1000);

    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-schedule-data/`,
      body: data,
    });

    render(<MockTimelineVisualization schedule={schedule} />);

    expect(request).toHaveBeenCalled();
    expect(await screen.findByText('Nov 22, 2023')).toBeInTheDocument();
    expect(await screen.findByText('Nov 24, 2023')).toBeInTheDocument();
    expect(await screen.findByText('Nov 26, 2023')).toBeInTheDocument();
  });

  it('should scale num_ticks based on failure/recovery thresholds', async () => {
    const schedule = {
      cronSchedule: '0 * * * *',
      scheduleType: 'crontab',
    };
    const data = [
      new Date('2023/11/20'),
      new Date('2023/11/21'),
      new Date('2023/11/22'),
      new Date('2023/11/23'),
      new Date('2023/11/24'),
      new Date('2023/11/25'),
      new Date('2023/11/26'),
      new Date('2023/11/27'),
      new Date('2023/11/28'),
    ].map(date => date.getTime() / 1000);

    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-schedule-data/`,
      body: data,
    });

    render(
      <MockTimelineVisualization
        schedule={schedule}
        failureTolerance={5}
        recoveryThreshold={7}
      />
    );

    // Ensure the query includes a larger num_ticks, derived from thresholds.
    const params = request.mock.calls[0]?.[0];
    expect(params?.query?.num_ticks).toBeGreaterThanOrEqual(5 + 7);
    expect(await screen.findByText('New Open Period')).toBeInTheDocument();
  });
});
