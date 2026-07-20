import {EventFixture} from 'sentry-fixture/event';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useEventLogsUrl} from 'sentry/components/events/ourlogs/useEventLogsUrl';

const project = ProjectFixture();

describe('useEventLogsUrl', () => {
  it('returns null when there is no context trace_id', () => {
    const event = EventFixture({
      contexts: {},
      dateCreated: '12-21-2024',
    });

    const {result} = renderHookWithProviders(() => useEventLogsUrl(event, project));

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

    const {result} = renderHookWithProviders(() => useEventLogsUrl(event, project));

    expect(result.current).toBeNull();
  });

  it('returns the logs url with empty environment when the environment does not exist', () => {
    const event = EventFixture({
      contexts: {
        trace: {
          trace_id: 'trace-abc-123',
        },
      },
      dateCreated: '12-21-2024',
    });

    const {result} = renderHookWithProviders(() => useEventLogsUrl(event, project));

    expect(result.current).toMatchInlineSnapshot(
      `"/organizations/org-slug/explore/logs/?end=2024-12-22T05%3A00%3A00&logsQuery=trace%3Atrace-abc-123&project=2&start=2024-12-20T05%3A00%3A00"`
    );
  });

  it('returns the logs url with an environment when the environment exists', () => {
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

    const {result} = renderHookWithProviders(() => useEventLogsUrl(event, project));

    expect(result.current).toMatchInlineSnapshot(
      `"/organizations/org-slug/explore/logs/?end=2024-12-22T05%3A00%3A00&environment=environment-abc-123&logsQuery=trace%3Atrace-abc-123&project=2&start=2024-12-20T05%3A00%3A00"`
    );
  });
});
