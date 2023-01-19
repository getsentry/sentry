import * as Sentry from '@sentry/react';
import keyBy from 'lodash/keyBy';

import {t} from 'sentry/locale';
import {
  EntrySpans,
  EntryType,
  EventTransaction,
  IssueCategory,
  IssueType,
  PlatformType,
} from 'sentry/types';

import {RawSpanType} from '../spans/types';

import {ResourceLink} from './resources';
import {TraceContextSpanProxy} from './spanEvidence';

const RESOURCES_DESCRIPTIONS: Record<IssueType, string> = {
  [IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: t(
    'Consecutive DB Queries are a sequence of database spans where one or more have been identified as parallelizable, or in other words, spans that may be shifted to the start of the sequence. This often occurs when a db query performs no filtering on the data, for example a query without a WHERE clause. To learn more about how to fix consecutive DB queries, check out these resources:'
  ),
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: t(
    "N+1 queries are extraneous queries (N) caused by a single, initial query (+1). In the Span Evidence above, we've identified the parent span where the extraneous spans are located and the extraneous spans themselves. To learn more about how to fix N+1 problems, check out these resources:"
  ),
  [IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS]: t(
    "N+1 API Calls are repeated concurrent calls to fetch a resource type. In the Span Evidence section we've identified the repeated calls. To learn more about how and when to fix N+1 API Calls, check out these resources:"
  ),
  [IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD]: t(
    'File IO operations on your main thread may cause app hangs.'
  ),
  [IssueType.PERFORMANCE_SLOW_DB_QUERY]: t(
    'Slow DB Queries are SELECT query spans that take longer than 1s. A quick method to understand why this may be the case is running an EXPLAIN command on the query itself. To learn more about how to fix slow DB queries, check out these resources:'
  ),
  [IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET]: t(
    'Large render blocking assets are a type of resource that is delaying the First Contentful Paint (FCP). Delaying FCP impacts how long it takes to initially load the page for the user. The resource may take form of a script, stylesheet, image, or other asset that may require optimization. To learn more about how to fix large render blocking assets, check out these resources:'
  ),
  [IssueType.PERFORMANCE_UNCOMPRESSED_ASSET]: t(
    'Uncompressed assets are asset spans that take over 200ms and are larger than 512kB which can usually be made faster with compression. Check that your server or CDN serving your assets is accepting the content encoding header from the browser and is returning them compressed.'
  ),
  [IssueType.ERROR]: '',
};

type PlatformSpecificResources = Partial<Record<PlatformType, ResourceLink[]>>;

const DEFAULT_RESOURCE_LINK: Record<IssueType, ResourceLink[]> = {
  [IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: [
    {
      text: t('Sentry Docs: Consecutive DB Queries'),
      link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/consecutive-db-queries/',
    },
  ],
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: [
    {
      text: t('Sentry Docs: N+1 Queries'),
      link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/n-one-queries/',
    },
  ],
  [IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS]: [
    {
      text: t('Sentry Docs: N+1 API Calls'),
      link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/n-one-api-calls/',
    },
  ],
  [IssueType.PERFORMANCE_UNCOMPRESSED_ASSET]: [],
  [IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD]: [],
  [IssueType.PERFORMANCE_SLOW_DB_QUERY]: [],
  [IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET]: [
    {
      text: t('Web Vital: First Contentful Paint'),
      link: 'https://web.dev/fcp/',
    },
  ],
  [IssueType.PERFORMANCE_SLOW_DB_QUERY]: [],
  [IssueType.ERROR]: [],
};

// TODO: When the Sentry blogpost for N+1s and documentation has been released, add them as resources for all platforms
const RESOURCE_LINKS: Record<IssueType, PlatformSpecificResources> = {
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: {
    python: [
      {
        text: t('Finding and Fixing Django N+1 Problems'),
        link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
      },
    ],
    'python-django': [
      {
        text: t('Finding and Fixing Django N+1 Problems'),
        link: 'https://blog.sentry.io/2020/09/14/finding-and-fixing-django-n-1-problems',
      },
    ],
  },
  [IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS]: {},
  [IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: {},
  [IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD]: {},
  [IssueType.PERFORMANCE_SLOW_DB_QUERY]: {},
  [IssueType.PERFORMANCE_UNCOMPRESSED_ASSET]: {},
  [IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET]: {},
  [IssueType.ERROR]: {},
};

export function getResourceDescription(issueType: IssueType): string {
  return RESOURCES_DESCRIPTIONS[issueType];
}

export function getResourceLinks(
  issueType: IssueType,
  platform: PlatformType | undefined
): ResourceLink[] {
  let links: ResourceLink[] = [];
  if (DEFAULT_RESOURCE_LINK[issueType]) {
    links = [...DEFAULT_RESOURCE_LINK[issueType]];
  }
  if (RESOURCE_LINKS[issueType] && platform) {
    const platformLink = RESOURCE_LINKS[issueType][platform];
    if (platformLink) {
      links = [...links, ...platformLink];
    }
  }
  return links;
}

export function getSpanInfoFromTransactionEvent(
  event: Pick<
    EventTransaction,
    'entries' | 'perfProblem' | 'issueCategory' | 'endTimestamp' | 'contexts'
  >
) {
  if (!event.perfProblem) {
    if (
      event.issueCategory === IssueCategory.PERFORMANCE &&
      event.endTimestamp > 1663560000 //  (Sep 19, 2022 onward), Some events could have been missing evidence before EA
    ) {
      Sentry.captureException(new Error('Span Evidence missing for performance issue.'));
    }
    return null;
  }

  // Let's dive into the event to pick off the span evidence data by using the IDs we know
  const spanEntry = event.entries.find((entry: EntrySpans | any): entry is EntrySpans => {
    return entry.type === EntryType.SPANS;
  });

  const spans: Array<RawSpanType | TraceContextSpanProxy> = spanEntry?.data
    ? [...spanEntry.data]
    : [];

  if (event?.contexts?.trace && event?.contexts?.trace?.span_id) {
    // TODO: Fix this conditional and check if span_id is ever actually undefined.
    spans.push(event.contexts.trace as TraceContextSpanProxy);
  }
  const spansById = keyBy(spans, 'span_id');

  const parentSpanIDs = event?.perfProblem?.parentSpanIds ?? [];
  const offendingSpanIDs = event?.perfProblem?.offenderSpanIds ?? [];
  const causeSpanIDs = event?.perfProblem?.causeSpanIds ?? [];

  return {
    parentSpan: spansById[parentSpanIDs[0]],
    offendingSpans: offendingSpanIDs.map(spanID => spansById[spanID]),
    causeSpans: causeSpanIDs.map(spanID => spansById[spanID]),
  };
}
