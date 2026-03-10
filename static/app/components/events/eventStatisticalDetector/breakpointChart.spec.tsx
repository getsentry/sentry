import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventBreakpointChart from './breakpointChart';

describe('EventBreakpointChart', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        'count()': {data: []},
        'p95(transaction.duration)': {data: []},
      },
    });
  });

  it('renders an Open in Explore action with equivalent query context', async () => {
    const event = EventFixture({
      occurrence: {
        evidenceData: {
          breakpoint: 1706745600,
          transaction: '/api/orders',
        },
      },
    });

    render(<EventBreakpointChart event={event} />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/1/',
          query: {
            environment: 'prod',
          },
        },
      },
    });

    const link = await screen.findByRole('button', {name: 'Open in Explore'});
    expect(link).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/traces/?end=2017-10-17T02%3A41%3A20.000&environment=prod&mode=samples&project=-1&query=transaction%3A%22%2Fapi%2Forders%22%20is_transaction%3ATrue&start=2024-01-18T00%3A00%3A00.000&utc=true&visualize=%7B%22yAxes%22%3A%5B%22p95%28span.duration%29%22%5D%7D'
    );
  });
});
