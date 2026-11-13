import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {EAPChartsWidget, EAPWidgetType} from './eapChartsWidget';

describe('EAPChartsWidget', () => {
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

  it('shows default widget type when no query param is provided', async () => {
    render(<EAPChartsWidget transactionName={transactionName} query="" />);

    await waitFor(() => {
      expect(screen.getByText('Duration Breakdown')).toBeInTheDocument();
    });
  });

  it('shows default widget when invalid query param is provided', async () => {
    render(<EAPChartsWidget transactionName={transactionName} query="" />, {
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

  it('selects a chart in a new history entry when an option is picked', async () => {
    const {router} = render(
      <EAPChartsWidget transactionName={transactionName} query="" />,
      {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/insights/summary/'},
        },
      }
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Duration Breakdown'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'Duration Percentiles'}));
    await waitFor(() =>
      expect(router.location.query.chartDisplay).toBe(EAPWidgetType.DURATION_PERCENTILES)
    );
    act(() => router.navigate(-1));

    await waitFor(() => expect(router.location.query.chartDisplay).toBeUndefined());
  });
});
