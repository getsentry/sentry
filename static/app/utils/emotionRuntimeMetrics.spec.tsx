import createCache from '@emotion/cache';
import {css} from '@emotion/react';
import {SentrySpan} from '@sentry/core';
import * as Sentry from '@sentry/react';

import {
  instrumentEmotionCache,
  reportEmotionRuntimeMetrics,
} from 'sentry/utils/emotionRuntimeMetrics';

describe('emotionRuntimeMetrics', () => {
  const handlers: Record<string, (span: SentrySpan) => void> = {};
  const client = {
    on: jest.fn((hook: string, callback: (span: SentrySpan) => void) => {
      handlers[hook] = callback;
      return () => {};
    }),
  } as unknown as Parameters<typeof reportEmotionRuntimeMetrics>[0];

  const cache = createCache({key: 'metrics-test'});
  instrumentEmotionCache(cache);
  reportEmotionRuntimeMetrics(client);

  function insert(styles: string) {
    const serialized = css(styles);
    cache.insert(`.${cache.key}-${serialized.name}`, serialized, cache.sheet, true);
  }

  beforeEach(() => {
    jest.mocked(Sentry.metrics.distribution).mockClear();
  });

  it('reports styles inserted during a sampled pageload', () => {
    const span = new SentrySpan({op: 'pageload', name: '/issues/', sampled: true});
    handlers.spanStart!(span);

    insert('color: red;');
    insert('color: blue;');
    handlers.spanEnd!(span);

    const attributes = {transaction: '/issues/', 'span.op': 'pageload'};
    expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
      'ui.emotion.styles-inserted',
      2,
      {attributes}
    );
    expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
      'ui.emotion.insert-time',
      expect.any(Number),
      {unit: 'millisecond', attributes}
    );
  });

  it('starts counting again when a navigation starts', () => {
    insert('color: green;');

    const span = new SentrySpan({
      op: 'navigation',
      name: '/explore/traces/',
      sampled: true,
    });
    handlers.spanStart!(span);
    insert('color: purple;');
    handlers.spanEnd!(span);

    expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
      'ui.emotion.styles-inserted',
      1,
      {attributes: {transaction: '/explore/traces/', 'span.op': 'navigation'}}
    );
  });

  it('ignores unsampled and non-navigation spans', () => {
    const unsampled = new SentrySpan({op: 'pageload', name: '/issues/', sampled: false});
    handlers.spanStart!(unsampled);
    handlers.spanEnd!(unsampled);

    const request = new SentrySpan({op: 'http.client', name: 'GET /api/', sampled: true});
    handlers.spanStart!(request);
    handlers.spanEnd!(request);

    expect(Sentry.metrics.distribution).not.toHaveBeenCalled();
  });
});
