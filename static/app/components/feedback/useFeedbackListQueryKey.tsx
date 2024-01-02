import {useMemo} from 'react';

import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import type {Organization} from 'sentry/types';
import {intervalToMilliseconds} from 'sentry/utils/dates';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

interface Props {
  organization: Organization;
}

const PER_PAGE = 25;

export default function useFeedbackListQueryKey({organization}: Props): ApiQueryKey {
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

    const {statsPeriod, ...rest} = queryView;
    const now = Date.now();
    const statsPeriodMs = intervalToMilliseconds(statsPeriod);
    return statsPeriod
      ? {
          ...rest,
          start: new Date(now - statsPeriodMs).toISOString(),
          end: new Date(now).toISOString(),
        }
      : // The issues endpoint cannot handle when statsPeroid has a value of "", so
        // we remove that from the rest and do not use it to query.
        rest;
  }, [queryView]);

  return useMemo(() => {
    const {mailbox, ...fixedQueryView} = queryViewWithStatsPeriod;
    return [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          ...fixedQueryView,
          collapse: ['inbox'],
          expand: [
            'owners', // Gives us assignment
            'stats', // Gives us `firstSeen`
            'pluginActions', // Gives us plugin actions available
            'pluginIssues', // Gives us plugin issues available
          ],
          shortIdLookup: 0,
          query: `issue.category:feedback status:${mailbox} ${fixedQueryView.query}`,
        },
      },
    ];
  }, [queryViewWithStatsPeriod, organization.slug]);
}
