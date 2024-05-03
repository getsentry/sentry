import {useMemo} from 'react';

import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import type {Organization} from 'sentry/types/organization';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

interface Props {
  listHeadTime: number;
  organization: Organization;
  prefetch: boolean;
}

const PER_PAGE = 25;
const ONE_DAY_MS = intervalToMilliseconds('1d');

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

  const queryViewWithStatsPeriod = useMemo(() => {
    // We don't want to use `statsPeriod` directly, because that will mean the
    // start time of our infinite list will change, shifting the index/page
    // where items appear if we invalidate the cache and refetch specific pages.
    // So we'll convert statsPeriod into start/end time here, and use that. When
    // the user wants to see fresher content (like, after the page has been open
    // for a while) they can trigger that specifically.

    // The issues endpoint cannot handle when statsPeroid has a value of "", so
    // we remove that from the rest and do not use it to query.
    const {statsPeriod, ...rest} = queryView;

    // Usually we want to fetch starting from `now` and looking back in time.
    // `prefetch` in this case changes the mode: instead of looking back, we want
    // to look forward for new data, and fetch it before it's time to render.
    // Note: The ApiQueryKey that we return isn't actually for a full page of
    // prefetched data, it's just one row actually.
    if (prefetch) {
      if (!statsPeriod) {
        // We shouldn't prefetch if the query uses an absolute date range
        return undefined;
      }
      // Look 1 day into the future, from the time the page is loaded for new
      // feedbacks to come in.
      const intervalMS = ONE_DAY_MS;
      const start = new Date(listHeadTime).toISOString();
      const end = new Date(listHeadTime + intervalMS).toISOString();
      return statsPeriod ? {...rest, limit: 1, start, end} : undefined;
    }

    const intervalMS = intervalToMilliseconds(statsPeriod);
    const start = new Date(listHeadTime - intervalMS).toISOString();
    const end = new Date(listHeadTime).toISOString();
    return statsPeriod ? {...rest, start, end} : rest;
  }, [listHeadTime, prefetch, queryView]);

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
          collapse: ['inbox'],
          expand: prefetch
            ? []
            : [
                'owners', // Gives us assignment
                'stats', // Gives us `firstSeen`
                'pluginActions', // Gives us plugin actions available
                'pluginIssues', // Gives us plugin issues available
                'integrationIssues', // Gives us integration issues available
                'sentryAppIssues', // Gives us Sentry app issues available
                'hasAttachments', // Gives us whether the feedback has screenshots
              ],
          shortIdLookup: 0,
          query: `issue.category:feedback status:${mailbox} ${fixedQueryView.query}`,
        },
      },
    ];
  }, [organization.slug, prefetch, queryViewWithStatsPeriod]);
}
