import {OrganizationFixture} from 'sentry-fixture/organization';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {ConversationsChart} from 'sentry/views/explore/conversations/components/conversationsChart';

jest.mock('sentry/actionCreators/modal');

describe('ConversationsChart', () => {
  const organization = OrganizationFixture();

  let timeseriesRequest: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    timeseriesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'count_unique(gen_ai.conversation.id)',
            meta: {valueType: 'number', valueUnit: null, interval: 1_800_000},
          }),
        ],
      },
    });
  });

  it('fetches the conversation count timeseries by default', async () => {
    render(<ConversationsChart />, {organization});

    await waitFor(() => {
      expect(timeseriesRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-timeseries/`,
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: ['count_unique(gen_ai.conversation.id)'],
            query: 'has:gen_ai.conversation.id',
          }),
        })
      );
    });

    expect(screen.getByRole('button', {name: 'Conversation Count'})).toBeInTheDocument();
  });

  it('switches the visualization via the title dropdown', async () => {
    const {router} = render(<ConversationsChart />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Conversation Count'}));
    await userEvent.click(screen.getByRole('option', {name: 'Cost'}));

    await waitFor(() => {
      expect(router.location.query.chartVisualization).toBe('cost');
    });

    expect(await screen.findByRole('button', {name: 'Cost'})).toBeInTheDocument();

    await waitFor(() => {
      expect(timeseriesRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-timeseries/`,
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: ['sum(gen_ai.cost.total_tokens)'],
            query: 'has:gen_ai.conversation.id gen_ai.operation.type:ai_client',
          }),
        })
      );
    });
  });

  it('fetches the total messages timeseries', async () => {
    render(<ConversationsChart />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Conversation Count'}));
    await userEvent.click(screen.getByRole('option', {name: 'Total Messages'}));

    await waitFor(() => {
      expect(timeseriesRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-timeseries/`,
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: ['count(span.duration)'],
            query: 'has:gen_ai.conversation.id gen_ai.operation.type:ai_client',
          }),
        })
      );
    });
  });

  it('switches the chart type', async () => {
    const {router} = render(<ConversationsChart />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Bar'}));
    await userEvent.click(screen.getByRole('option', {name: 'Line'}));

    await waitFor(() => {
      expect(router.location.query.chartType).toBe('line');
    });

    expect(screen.getByRole('button', {name: 'Line'})).toBeInTheDocument();
  });

  it('switches the chart type to area', async () => {
    const {router} = render(<ConversationsChart />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Bar'}));
    await userEvent.click(screen.getByRole('option', {name: 'Area'}));

    await waitFor(() => {
      expect(router.location.query.chartType).toBe('area');
    });

    expect(screen.getByRole('button', {name: 'Area'})).toBeInTheDocument();
  });

  it('applies the search query and agent filter to the timeseries request', async () => {
    render(<ConversationsChart />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {query: 'gen_ai.agent.name:my-agent'},
        },
      },
    });

    await waitFor(() => {
      expect(timeseriesRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-timeseries/`,
        expect.objectContaining({
          query: expect.objectContaining({
            query: '(has:gen_ai.conversation.id) and (gen_ai.agent.name:my-agent)',
          }),
        })
      );
    });
  });

  it('shows an empty state when there is no data', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {timeSeries: []},
    });

    render(<ConversationsChart />, {organization});

    expect(await screen.findByText('No Data')).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(<ConversationsChart />, {organization});

    expect(await screen.findByText('Internal Error')).toBeInTheDocument();
  });

  it('collapses and expands the chart', async () => {
    const {router} = render(<ConversationsChart />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Collapse chart'}));

    await waitFor(() => {
      expect(router.location.query.chartCollapsed).toBe('true');
    });

    // Collapsing hides the chart-type/interval controls and reveals the expander.
    const expandButton = await screen.findByRole('button', {name: 'Expand chart'});
    expect(
      screen.queryByRole('button', {name: 'Collapse chart'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Bar'})).not.toBeInTheDocument();

    await userEvent.click(expandButton);

    // Expanding resets to the default, which nuqs strips from the URL.
    await waitFor(() => {
      expect(router.location.query.chartCollapsed).toBeUndefined();
    });
    expect(
      await screen.findByRole('button', {name: 'Collapse chart'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Expand chart'})).not.toBeInTheDocument();
  });

  it('links to the metric monitor builder for the current visualization', async () => {
    render(<ConversationsChart />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Chart actions'}));

    const alertItem = await screen.findByRole('menuitemradio', {
      name: 'Create a Monitor',
    });
    const href = alertItem.getAttribute('href') ?? '';
    expect(href).toContain('/monitors/new/settings');
    expect(href).toContain('detectorType=metric_issue');
    expect(href).toContain('aggregate=count_unique');
    expect(href).toContain('gen_ai.conversation.id');
  });

  it('disables "Add to Dashboard" without the dashboards-edit feature', async () => {
    render(<ConversationsChart />, {
      organization: OrganizationFixture({features: []}),
    });

    await userEvent.click(screen.getByRole('button', {name: 'Chart actions'}));

    expect(
      await screen.findByRole('menuitemradio', {name: 'Add to Dashboard'})
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('opens the add-to-dashboard modal with the dashboards-edit feature', async () => {
    render(<ConversationsChart />, {
      organization: OrganizationFixture({features: ['dashboards-edit']}),
    });

    await userEvent.click(screen.getByRole('button', {name: 'Chart actions'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Add to Dashboard'})
    );

    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        widgets: [
          expect.objectContaining({
            displayType: DisplayType.BAR,
            widgetType: WidgetType.SPANS,
            queries: [
              expect.objectContaining({
                aggregates: ['count_unique(gen_ai.conversation.id)'],
                conditions: 'has:gen_ai.conversation.id',
              }),
            ],
          }),
        ],
      })
    );
  });

  it('maps the area chart type to the area dashboard display type', async () => {
    render(<ConversationsChart />, {
      organization: OrganizationFixture({features: ['dashboards-edit']}),
      initialRouterConfig: {
        location: {pathname: '/', query: {chartType: 'area'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Chart actions'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Add to Dashboard'})
    );

    expect(openAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        widgets: [expect.objectContaining({displayType: DisplayType.AREA})],
      })
    );
  });
});
