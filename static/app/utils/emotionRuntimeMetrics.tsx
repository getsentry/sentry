import type {EmotionCache} from '@emotion/cache';
import {SEARCH_SPAN__OP, SEARCH_TRANSACTION} from '@sentry/conventions/attributes/search';
import {spanIsSampled} from '@sentry/core';
import * as Sentry from '@sentry/react';

type Client = NonNullable<ReturnType<typeof Sentry.getClient>>;
type Span = Parameters<typeof Sentry.spanToJSON>[0];

/**
 * Style blocks Emotion inserted at runtime (one per new class name) and the
 * time spent inserting them (stylis compilation + CSSOM insertRule), since the
 * current pageload/navigation started.
 */
const counters = {inserted: 0, insertMs: 0};

/**
 * Counts and times every style block inserted through `cache`. Runtime
 * insertion is work a compile-time styling library does not do, so these
 * numbers trend towards zero as components move off Emotion.
 */
export function instrumentEmotionCache(cache: EmotionCache) {
  const insert = cache.insert;
  cache.insert = (...args) => {
    const start = performance.now();
    try {
      return insert.apply(cache, args);
    } finally {
      counters.insertMs += performance.now() - start;
      counters.inserted++;
    }
  };
}

function getNavigationOp(span: Span) {
  if (Sentry.getRootSpan(span) !== span) {
    return null;
  }
  const op = Sentry.spanToJSON(span).attributes?.[Sentry.SEMANTIC_ATTRIBUTE_SENTRY_OP];
  return op === 'pageload' || op === 'navigation' ? op : null;
}

/**
 * Reports Emotion's runtime insertion work for every sampled pageload and
 * navigation, attributed to its transaction (route). Must be called after the SDK is
 * initialized; the pageload window starts when the cache is created.
 */
export function reportEmotionRuntimeMetrics(
  client: Client | undefined = Sentry.getClient()
) {
  if (!client) {
    return;
  }

  client.on('spanStart', span => {
    if (getNavigationOp(span)) {
      counters.inserted = 0;
      counters.insertMs = 0;
    }
  });

  client.on('spanEnd', span => {
    const op = getNavigationOp(span);
    if (!op || !spanIsSampled(span)) {
      return;
    }
    const attributes = {
      [SEARCH_TRANSACTION]: Sentry.spanToJSON(span).name,
      [SEARCH_SPAN__OP]: op,
    };
    Sentry.metrics.distribution('ui.emotion.styles-inserted', counters.inserted, {
      attributes,
    });
    Sentry.metrics.distribution('ui.emotion.insert-time', counters.insertMs, {
      unit: 'millisecond',
      attributes,
    });
  });
}
