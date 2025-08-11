import {useMemo} from 'react';

import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import type {Organization} from 'sentry/types/organization';
import coaleseIssueStatsPeriodQuery from 'sentry/utils/feedback/coaleseIssueStatsPeriodQuery';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

interface Props {
  listHeadTime: number;
  organization: Organization;
  prefetch: boolean;
}

const PER_PAGE = 25;

export default function useFeedbackListQueryKey({
  listHeadTime,
  organization,
  prefetch,
}: Props): ApiQueryKey | undefined {
  const queryView = useLocationQuery({
    fields: {
      limit: PER_PAGE,
      queryReferrer: 'feedback_list_page',
      end: decodeScalar,
      environment: decodeList,
      field: decodeList,
      project: decodeList,
      query: decodeScalar,
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
      mailbox: decodeMailbox,
    },
  });

  const queryViewWithStatsPeriod = useMemo(
    () =>
      coaleseIssueStatsPeriodQuery({
        defaultStatsPeriod: '0d',
        listHeadTime,
        prefetch,
        queryView,
      }),
    [listHeadTime, prefetch, queryView]
  );

  return useMemo(() => {
    if (!queryViewWithStatsPeriod) {
      return undefined;
    }
    const {mailbox, ...fixedQueryView} = queryViewWithStatsPeriod;

    return [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          ...fixedQueryView,
          expand: prefetch
            ? []
            : [
                'pluginActions', // Gives us plugin actions available
                'pluginIssues', // Gives us plugin issues available
                'integrationIssues', // Gives us integration issues available
                'sentryAppIssues', // Gives us Sentry app issues available
                'latestEventHasAttachments', // Gives us whether the feedback has screenshots
              ],
          shortIdLookup: 0,
          query: `issue.category:feedback status:${mailbox} ${fixedQueryView.query}`,
        },
      },
    ];
  }, [organization.slug, prefetch, queryViewWithStatsPeriod]);
}
