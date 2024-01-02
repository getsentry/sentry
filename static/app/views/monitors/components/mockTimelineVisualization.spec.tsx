import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MockTimelineVisualization} from 'sentry/views/monitors/components/mockTimelineVisualization';

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
    expect(await screen.findByText('Nov 21, 2023')).toBeInTheDocument();
  });
});
