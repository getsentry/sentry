import {EventFixture} from 'sentry-fixture/event';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useEventLogsUrl} from 'sentry/components/events/ourlogs/useEventLogsUrl';

describe('useEventLogsUrl', () => {
  it('returns null when there is no context trace_id', () => {
    const event = EventFixture({
      contexts: {},
      dateCreated: '12-21-2024',
    });

    const {result} = renderHookWithProviders(() => useEventLogsUrl(event));

    expect(result.current).toBeNull();
  });

  it('returns null when there is no dateCreated or dateReceived', () => {
    const event = EventFixture({
      contexts: {
        trace: {
          trace_id: 'trace-abc-123',
        },
      },
      dateCreated: null,
      dateReceived: null,
    });

    const {result} = renderHookWithProviders(() => useEventLogsUrl(event));

    expect(result.current).toBeNull();
  });

  it('returns the logs url scoped to all projects with empty environment when the environment does not exist', () => {
    const event = EventFixture({
      contexts: {
        trace: {
          trace_id: 'trace-abc-123',
        },
      },
      dateCreated: '12-21-2024',
    });

    const {result} = renderHookWithProviders(() => useEventLogsUrl(event));

    expect(result.current).toMatchInlineSnapshot(
      `"/organizations/org-slug/explore/logs/?end=2024-12-22T05%3A00%3A00&logsQuery=trace%3Atrace-abc-123&project=-1&start=2024-12-20T05%3A00%3A00"`
    );
  });

  it('returns the logs url without an environment filter even when the event has an environment', () => {
    const event = EventFixture({
      contexts: {
        trace: {
          trace_id: 'trace-abc-123',
        },
      },
      dateCreated: '12-21-2024',
      tags: [
        {
          key: 'environment',
          value: 'environment-abc-123',
        },
      ],
    });

    const {result} = renderHookWithProviders(() => useEventLogsUrl(event));

    expect(result.current).toMatchInlineSnapshot(
      `"/organizations/org-slug/explore/logs/?end=2024-12-22T05%3A00%3A00&logsQuery=trace%3Atrace-abc-123&project=-1&start=2024-12-20T05%3A00%3A00"`
    );
  });
});
