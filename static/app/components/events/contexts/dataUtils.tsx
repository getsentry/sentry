import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils/defined';

/**
 * Omit certain keys from ever being displayed on context items.
 * All custom context (and some known context) has the type:default so we remove it.
 */
export function getContextKeys({
  data,
  hiddenKeys = [],
}: {
  data: Record<string, any>;
  hiddenKeys?: string[];
}): string[] {
  const hiddenKeySet = new Set(hiddenKeys);
  return Object.keys(data).filter(
    ctxKey => ctxKey !== 'type' && !hiddenKeySet.has(ctxKey)
  );
}

export function getContextMeta(
  event: Event | undefined,
  contextType: string
): Record<string, any> {
  const defaultMeta = event?._meta?.contexts?.[contextType] ?? {};
  switch (contextType) {
    case 'memory_info': // Current
    case 'Memory Info': // Legacy
      return event?._meta?.contexts?.['Memory Info'] ?? defaultMeta;
    case 'threadpool_info': // Current
    case 'ThreadPool Info': // Legacy
      return event?._meta?.contexts?.['ThreadPool Info'] ?? defaultMeta;
    case 'user':
      return event?._meta?.user ?? defaultMeta;
    default:
      return defaultMeta;
  }
}

export function getRelativeTimeFromEventDateCreated(
  eventDateCreated: string | undefined,
  timestamp?: string
) {
  if (!defined(timestamp)) {
    return timestamp;
  }

  const dateTime = moment(timestamp);

  if (!dateTime.isValid()) {
    return timestamp;
  }

  // Without a valid reference date (e.g. the event isn't available) we can't
  // compute a relative time, so just show the timestamp on its own.
  const referenceDate = moment(eventDateCreated);
  if (!eventDateCreated || !referenceDate.isValid()) {
    return timestamp;
  }

  const relativeTime = `(${dateTime.from(referenceDate, true)} ${t(
    'before this event'
  )})`;

  return (
    <Fragment>
      {timestamp}
      <RelativeTime>{relativeTime}</RelativeTime>
    </Fragment>
  );
}

const RelativeTime = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  margin-left: ${p => p.theme.space.xs};
`;
