import {useMemo} from 'react';
import {skipToken} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';

import {useMailbox} from 'sentry/components/feedback/useMailbox';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {coaleseIssueStatsPeriodQuery} from 'sentry/utils/feedback/coaleseIssueStatsPeriodQuery';
import type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';
import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';

interface Props {
  listHeadTime: number;
  organization: Organization;
  prefetch: boolean;
}

const PER_PAGE = 25;

const feedbackListParsers = {
  end: parseAsString.withDefault(''),
  environment: parseAsStringArray,
  field: parseAsStringArray,
  project: parseAsStringArray,
  query: parseAsString.withDefault(''),
  start: parseAsString.withDefault(''),
  statsPeriod: parseAsString.withDefault(''),
  utc: parseAsString.withDefault(''),
};

function useFeedbackListQuery({listHeadTime, organization, prefetch}: Props) {
  const [mailbox] = useMailbox();
  const [locationQuery] = useQueryStates(feedbackListParsers);
  const queryView = useMemo(
    () => ({limit: PER_PAGE, queryReferrer: 'feedback_list_page', ...locationQuery}),
    [locationQuery]
  );

  const fixedQueryView = useMemo(
    () =>
      coaleseIssueStatsPeriodQuery({
        listHeadTime,
        prefetch,
        queryView,
      }),
    [listHeadTime, prefetch, queryView]
  );

  return useMemo(
    () => ({fixedQueryView, mailbox, orgSlug: organization.slug, prefetch}),
    [fixedQueryView, mailbox, organization.slug, prefetch]
  );
}

function buildQuery(params: {
  fixedQueryView: Record<string, any>;
  mailbox: string;
  prefetch: boolean;
}) {
  return {
    ...params.fixedQueryView,
    expand: params.prefetch ? [] : ['integrationIssues', 'sentryAppIssues'],
    shortIdLookup: 0,
    query: `issue.category:feedback status:${params.mailbox} ${params.fixedQueryView.query}`,
  };
}

export function useFeedbackListApiOptions(props: Props) {
  const {fixedQueryView, mailbox, orgSlug, prefetch} = useFeedbackListQuery(props);

  return useMemo(() => {
    return apiOptions.as<FeedbackIssueListItem[]>()(
      '/organizations/$organizationIdOrSlug/issues/',
      {
        path: fixedQueryView ? {organizationIdOrSlug: orgSlug} : skipToken,
        query: fixedQueryView
          ? buildQuery({fixedQueryView, mailbox, prefetch})
          : undefined,
        staleTime: 0,
      }
    );
  }, [orgSlug, prefetch, fixedQueryView, mailbox]);
}

export function useFeedbackListInfiniteApiOptions(props: Props) {
  const {fixedQueryView, mailbox, orgSlug, prefetch} = useFeedbackListQuery(props);

  return useMemo(() => {
    return apiOptions.asInfinite<FeedbackIssueListItem[]>()(
      '/organizations/$organizationIdOrSlug/issues/',
      {
        path: fixedQueryView ? {organizationIdOrSlug: orgSlug} : skipToken,
        query: fixedQueryView
          ? buildQuery({fixedQueryView, mailbox, prefetch})
          : undefined,
        staleTime: 0,
      }
    );
  }, [orgSlug, prefetch, fixedQueryView, mailbox]);
}
