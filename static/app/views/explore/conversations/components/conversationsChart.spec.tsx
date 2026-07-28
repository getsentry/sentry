import {OrganizationFixture} from 'sentry-fixture/organization';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConversationsChart} from 'sentry/views/explore/conversations/components/conversationsChart';

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
            yAxis: 'sum(gen_ai.cost.total_tokens)',
            meta: {valueType: 'number', valueUnit: null, interval: 1_800_000},
          }),
        ],
      },
    });
  });

  it('fetches the cost timeseries by default', async () => {
    render(<ConversationsChart />, {organization});

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

    expect(screen.getByRole('button', {name: 'Cost'})).toBeInTheDocument();
  });

  it('switches the visualization via the title dropdown', async () => {
    const {router} = render(<ConversationsChart />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Cost'}));
    await userEvent.click(screen.getByRole('option', {name: 'Individual Chats'}));

    await waitFor(() => {
      expect(router.location.query.chartVisualization).toBe('chats');
    });

    expect(
      await screen.findByRole('button', {name: 'Individual Chats'})
    ).toBeInTheDocument();

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
  });

  it('fetches the total messages timeseries', async () => {
    render(<ConversationsChart />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Cost'}));
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
            query:
              '(has:gen_ai.conversation.id gen_ai.operation.type:ai_client) and (gen_ai.agent.name:my-agent)',
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
});
