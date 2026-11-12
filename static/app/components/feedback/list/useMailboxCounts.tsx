import {useCallback, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';

import {useFeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {coaleseIssueStatsPeriodQuery} from 'sentry/utils/feedback/coaleseIssueStatsPeriodQuery';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';

interface Props {
  organization: Organization;
}

const mailboxCountsParsers = {
  ...pageFilterParsers,
  field: parseAsStringArray,
  query: parseAsString.withDefault(''),
};

// The keys here are the different search terms that we're using:
type ApiReturnType = Record<string, number>;

// This is what the hook consumer gets:
type HookReturnType = {
  ignored: number | undefined;
  resolved: number | undefined;
  unresolved: number | undefined;
};

export function useMailboxCounts({organization}: Props) {
  const [locationFields] = useQueryStates(mailboxCountsParsers);
  const locationQuery = locationFields.query;
  const {listHeadTime} = useFeedbackApiOptions();

  // We should fetch the counts while taking the query into account
  const MAILBOX: Record<keyof HookReturnType, keyof ApiReturnType> = useMemo(
    () => ({
      unresolved: 'issue.category:feedback is:unassigned is:unresolved ' + locationQuery,
      resolved: 'issue.category:feedback is:unassigned is:resolved ' + locationQuery,
      ignored: 'issue.category:feedback is:unassigned is:ignored ' + locationQuery,
    }),
    [locationQuery]
  );

  const mailboxQuery = useMemo(() => Object.values(MAILBOX), [MAILBOX]);

  // The request is keyed off this object, so it has to stay referentially stable
  // across renders that don't change the filters.
  const queryView = useMemo(
    () => ({
      ...locationFields,
      query: mailboxQuery,
      queryReferrer: 'feedback_mailbox_count',
    }),
    [locationFields, mailboxQuery]
  );

  const queryViewWithStatsPeriod = useMemo(
    () =>
      coaleseIssueStatsPeriodQuery({
        listHeadTime,
        queryView,
      }),
    [listHeadTime, queryView]
  );

  const select = useCallback(
    ({json}: ApiResponse<ApiReturnType>): HookReturnType => ({
      unresolved: json[MAILBOX.unresolved],
      resolved: json[MAILBOX.resolved],
      ignored: json[MAILBOX.ignored],
    }),
    [MAILBOX.ignored, MAILBOX.resolved, MAILBOX.unresolved]
  );
  return useQuery({
    ...apiOptions.as<ApiReturnType>()(
      '/organizations/$organizationIdOrSlug/issues-count/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
        },
        query: queryViewWithStatsPeriod,
        staleTime: 1_000,
      }
    ),
    refetchInterval: 30_000,
    select,
  });
}
