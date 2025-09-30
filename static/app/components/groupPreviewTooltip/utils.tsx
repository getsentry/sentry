import {useCallback, useMemo, useState} from 'react';

import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {joinQuery, Token} from 'sentry/components/searchSyntax/parser';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {
  getFieldDefinition,
  ISSUE_EVENT_PROPERTY_FIELDS,
  ISSUE_PROPERTY_FIELDS,
} from 'sentry/utils/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useTimeout from 'sentry/utils/useTimeout';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {
  getGroupEventQueryKey,
  useDefaultIssueEvent,
} from 'sentry/views/issueDetails/utils';

const HOVERCARD_CONTENT_DELAY = 400;

export function useDelayedLoadingState() {
  const [shouldShowLoadingState, setShouldShowLoadingState] = useState(false);

  const onTimeout = useCallback(() => {
    setShouldShowLoadingState(true);
  }, []);

  const {start, end, cancel} = useTimeout({
    timeMs: HOVERCARD_CONTENT_DELAY,
    onTimeout,
  });

  const reset = useCallback(() => {
    setShouldShowLoadingState(false);
    cancel();
  }, [cancel]);

  return {
    shouldShowLoadingState,
    onRequestBegin: start,
    onRequestEnd: end,
    reset,
  };
}

/**
 * Not quite the same filtering as useEventQuery because we don't want to make a request for the group tags.
 * Should be able to more closely match the event request query
 */
function sanitizeIssueEventQuery(query: string | undefined): string | undefined {
  if (!query) {
    return query;
  }
  const allowedEventFieldKeys = new Set(ISSUE_EVENT_PROPERTY_FIELDS as string[]);
  const unallowedEventFieldKeys = new Set(ISSUE_PROPERTY_FIELDS as string[]);
  const parsed =
    parseQueryBuilderValue(query, getFieldDefinition, {filterKeys: {}}) ?? [];
  const filtered = parsed.filter(token => {
    if (token.type === Token.FREE_TEXT) {
      return false;
    }
    if (token.type === Token.FILTER) {
      const key = token.key.text;
      if (unallowedEventFieldKeys.has(key)) {
        return false;
      }
      if (allowedEventFieldKeys.has(key)) {
        return true;
      }
      if (key === 'has' && token.value && 'text' in token.value) {
        return allowedEventFieldKeys.has(token.value.text);
      }
      return true;
    }
    return true;
  });
  return joinQuery(filtered, false, true);
}

export function usePreviewEvent<T = Event>({
  groupId,
  query,
}: {
  groupId: string;
  query?: string;
}) {
  const organization = useOrganization();
  const defaultIssueEvent = useDefaultIssueEvent();

  // Strip out any tokens that are not event level fields
  const sanitizedQuery = useMemo(() => sanitizeIssueEventQuery(query), [query]);

  // This query should attempt to match the one on group details so that the event will
  // be fully loaded already if you preview then click.
  const eventQuery = useApiQuery<T>(
    getGroupEventQueryKey({
      orgSlug: organization.slug,
      groupId,
      eventId: defaultIssueEvent,
      environments: [],
      query: sanitizedQuery,
    }),
    {staleTime: 30000}
  );

  // Prefetch the group as well, but don't use the result
  useGroup({groupId, options: {enabled: defined(groupId)}});

  return eventQuery;
}
