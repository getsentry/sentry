import {metrics} from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {RequestError} from 'sentry/utils/requestError/requestError';
import {
  queueApiFetch,
  useWidgetQueryQueue,
  WidgetQueryQueueProvider,
} from 'sentry/views/dashboards/utils/widgetQueryQueue';

const URL = '/organizations/org-slug/events-timeseries/';
const ENDPOINT = '/organizations/{org}/events-timeseries/';

function makeContext() {
  return {
    queryKey: [URL, {query: {}}],
    signal: new AbortController().signal,
    meta: undefined,
  } as any;
}

describe('queueApiFetch', () => {
  const organization = OrganizationFixture({dashboardsAsyncQueueParallelLimit: 2});

  function renderQueue() {
    return renderHookWithProviders(() => useWidgetQueryQueue(), {
      organization,
      additionalWrapper: ({children}: {children?: React.ReactNode}) => (
        <WidgetQueryQueueProvider>{children}</WidgetQueryQueueProvider>
      ),
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.mocked(metrics.count).mockClear();
  });

  it('resolves through the queue without recording a failure', async () => {
    const mock = MockApiClient.addMockResponse({
      url: URL,
      body: {timeSeries: []},
    });
    const {result} = renderQueue();

    let response: any;
    await act(async () => {
      response = await queueApiFetch(result.current.queue, makeContext());
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(response.json).toEqual({timeSeries: []});
    expect(metrics.count).not.toHaveBeenCalled();
  });

  it('records a failure with the status and endpoint when rate limited', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      statusCode: 429,
      body: {detail: 'Rate limited'},
    });
    const {result} = renderQueue();

    await act(async () => {
      await expect(queueApiFetch(result.current.queue, makeContext())).rejects.toThrow(
        RequestError
      );
    });

    await waitFor(() =>
      expect(metrics.count).toHaveBeenCalledWith('dashboards.widget_query.failed', 1, {
        attributes: {endpoint: ENDPOINT, status: '429'},
      })
    );
  });

  it('records a failure when fetching without a queue', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      statusCode: 500,
      body: {detail: 'Internal error'},
    });

    await expect(queueApiFetch(undefined, makeContext())).rejects.toThrow(RequestError);

    expect(metrics.count).toHaveBeenCalledWith('dashboards.widget_query.failed', 1, {
      attributes: {endpoint: ENDPOINT, status: '500'},
    });
  });
});
