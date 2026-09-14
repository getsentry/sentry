import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutomationStatsChart} from 'sentry/views/automations/components/automationStatsChart';

jest.mock('echarts-for-react/lib/core', function echartsMockFactory() {
  const ReactActual = require('react');

  return function MockEcharts({
    option,
  }: {
    option: {series: Array<{barMaxWidth?: number}>};
  }) {
    return ReactActual.createElement('div', {
      'aria-label': `Chart with maximum bar width ${option.series[0]?.barMaxWidth}`,
      role: 'img',
    });
  };
});

describe('AutomationStatsChart', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('caps the width of a single trigger bucket', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/stats/',
      body: [{date: '2026-01-13T20:00:00Z', count: 1}],
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

    expect(
      await screen.findByRole('img', {name: 'Chart with maximum bar width 40'})
    ).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
