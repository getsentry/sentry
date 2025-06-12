import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {EAPChartsWidget} from './eapChartsWidget';

describe('EAPChartsWidget', function () {
  const transactionName = 'test-transaction';

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
      status: 200,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows default widget type when no query param is provided', async function () {
    render(<EAPChartsWidget transactionName={transactionName} query={''} />);

    await waitFor(() => {
      expect(screen.getByText('Duration Breakdown')).toBeInTheDocument();
    });
  });

  it('shows default widget when invalid query param is provided', async function () {
    render(<EAPChartsWidget transactionName={transactionName} query={''} />, {
      initialRouterConfig: {
        route: '/organizations/:orgId/insights/summary/',
        location: {
          pathname: '/organizations/org-slug/insights/summary/',
          query: {
            chartDisplay: 'some_widget_that_does_not_exist',
          },
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Duration Breakdown')).toBeInTheDocument();
    });
  });
});
