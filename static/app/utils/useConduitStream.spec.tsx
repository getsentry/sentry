import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useConduitStream} from 'sentry/utils/useConduitStream';

type Message = {
  value: string;
};

const endpoint = '/organizations/org-slug/conduit-demo/';
const conduitHeaders = {
  'X-Conduit-Channel-Id': 'channel-id',
  'X-Conduit-Token': 'token',
  'X-Conduit-Url': 'https://conduit.example.com/events',
};

class MockEventSource {
  static instances: MockEventSource[] = [];

  close = jest.fn();
  listeners = new Map<string, Set<EventListener>>();

  constructor(public url: string | URL) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, data = '', lastEventId = '') {
    const event = new MessageEvent(type, {data, lastEventId});
    this.listeners.get(type)?.forEach(listener => listener(event));
  }
}

function conduitQueryOptions() {
  return apiOptions.as<{initialized: boolean}>()(
    '/organizations/$organizationIdOrSlug/conduit-demo/',
    {
      path: {organizationIdOrSlug: 'org-slug'},
      method: 'POST',
      staleTime: 0,
    }
  );
}

describe('useConduitStream', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    global.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('starts a stream from API response headers and returns the response body', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {initialized: true},
      headers: conduitHeaders,
    });

    const onConnect = jest.fn();
    const {result} = renderHookWithProviders(() =>
      useConduitStream({
        enabled: true,
        queryOptions: conduitQueryOptions(),
        onConnect,
        onMessage: (_message: Message) => {},
      })
    );

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    expect(result.current.data).toEqual({initialized: true});
    expect(MockEventSource.instances[0]!.url.toString()).toBe(
      'https://conduit.example.com/events?token=token&channel_id=channel-id'
    );

    act(() => MockEventSource.instances[0]!.emit('open'));

    expect(result.current.isConnected).toBe(true);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('delivers current messages once and ignores stale sequences', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {},
      headers: conduitHeaders,
    });

    const onMessage = jest.fn((_message: Message) => {});
    renderHookWithProviders(() =>
      useConduitStream({
        enabled: true,
        queryOptions: conduitQueryOptions(),
        onMessage,
      })
    );

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const eventSource = MockEventSource.instances[0]!;
    act(() => {
      eventSource.emit(
        'stream',
        JSON.stringify({
          event_type: 'stream',
          message_id: 'message-2',
          payload: {value: 'new'},
          phase: 'PHASE_DELTA',
          sequence: 2,
        })
      );
      eventSource.emit(
        'stream',
        JSON.stringify({
          event_type: 'stream',
          message_id: 'message-1',
          payload: {value: 'stale'},
          phase: 'PHASE_DELTA',
          sequence: 1,
        })
      );
      eventSource.emit(
        'stream',
        JSON.stringify({
          event_type: 'stream',
          message_id: 'message-2',
          payload: {value: 'duplicate'},
          phase: 'PHASE_DELTA',
          sequence: 3,
        })
      );
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({value: 'new'});
  });

  it('reports missing response headers without opening a stream', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(() =>
      useConduitStream({
        enabled: true,
        queryOptions: conduitQueryOptions(),
        onMessage: (_message: Message) => {},
      })
    );

    await waitFor(() =>
      expect(result.current.error).toEqual(new Error('Missing Conduit response headers'))
    );
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('does not request credentials when disabled', () => {
    const request = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: {},
      headers: conduitHeaders,
    });

    renderHookWithProviders(() =>
      useConduitStream({
        enabled: false,
        queryOptions: conduitQueryOptions(),
        onMessage: (_message: Message) => {},
      })
    );

    expect(request).not.toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(0);
  });
});
