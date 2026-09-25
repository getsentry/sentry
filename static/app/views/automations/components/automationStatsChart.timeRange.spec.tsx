import type {EChartsOption} from 'echarts';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutomationStatsChart} from 'sentry/views/automations/components/automationStatsChart';

let mockChartOptions: EChartsOption | undefined;

jest.mock('echarts-for-react/lib/core', () => {
  return function MockEcharts({option}: {option: EChartsOption}) {
    mockChartOptions = option;
    return null;
  };
});

describe('AutomationStatsChart time range', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockChartOptions = undefined;
  });

  it('uses the time range returned by the workflow stats endpoint on a time axis', async () => {
    const start = Date.parse('2026-01-13T19:00:00Z');
    const end = Date.parse('2026-01-13T20:00:00Z');
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/stats/',
      body: {
        meta: {dataset: 'workflow', start, end},
        timeSeries: [
          {
            yAxis: 'count()',
            values: [{timestamp: end, value: 1, incomplete: false}],
            meta: {interval: 60 * 60 * 1000, valueType: 'integer', valueUnit: null},
          },
        ],
      },
    });

    render(
      <AutomationStatsChart
        automationId="123"
        period="1h"
        start={null}
        end={null}
        utc={null}
      />,
      {organization}
    );

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(mockChartOptions).toMatchObject({
      xAxis: {type: 'time', min: start, max: end},
    });
  });
});
