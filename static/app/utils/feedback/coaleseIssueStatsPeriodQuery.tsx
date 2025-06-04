import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

const ONE_DAY_MS = intervalToMilliseconds('1d');

interface Props<QueryView extends {statsPeriod: string}> {
  listHeadTime: number;
  queryView: QueryView;
  defaultStatsPeriod?: string;
  prefetch?: boolean;
}

export default function coaleseIssueStatsPeriodQuery<
  QueryView extends {statsPeriod: string},
>({queryView, listHeadTime, defaultStatsPeriod, prefetch = false}: Props<QueryView>) {
  // We don't want to use `statsPeriod` directly, because that will mean the
  // start time of our infinite list will change, shifting the index/page
  // where items appear if we invalidate the cache and refetch specific pages.
  // So we'll convert statsPeriod into start/end time here, and use that. When
  // the user wants to see fresher content (like, after the page has been open
  // for a while) they can trigger that specifically.

  // The issues endpoint cannot handle when statsPeroid has a value of "", so
  // we remove that from the rest and do not use it to query.

  // Usually we want to fetch starting from `now` and looking back in time.
  // `prefetch` in this case changes the mode: instead of looking back, we want
  // to look forward for new data, and fetch it before it's time to render.
  // Note: The ApiQueryKey that we return isn't actually for a full page of
  // prefetched data, it's just one row actually.
  if (prefetch) {
    const {statsPeriod, ...rest} = queryView;
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

  const {statsPeriod = defaultStatsPeriod, ...rest} = queryView;
  const intervalMS = intervalToMilliseconds(statsPeriod ?? '');
  const start = new Date(listHeadTime - intervalMS).toISOString();
  const end = new Date(listHeadTime).toISOString();
  return statsPeriod ? {...rest, start, end} : rest;
}
