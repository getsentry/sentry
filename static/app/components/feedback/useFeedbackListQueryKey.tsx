import {useMemo} from 'react';

import {useMailbox} from 'sentry/components/feedback/useMailbox';
import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
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
  const [mailbox] = useMailbox();
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
    },
  });

  const fixedQueryView = useMemo(
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
    if (!fixedQueryView) {
      return undefined;
    }
    return [
      getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
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
  }, [organization.slug, prefetch, fixedQueryView, mailbox]);
}
