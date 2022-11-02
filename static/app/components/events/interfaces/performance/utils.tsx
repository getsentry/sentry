import * as Sentry from '@sentry/react';
import keyBy from 'lodash/keyBy';

import {t} from 'sentry/locale';
import {
  EntryType,
  EventTransaction,
  IssueCategory,
  IssueType,
  PlatformType,
} from 'sentry/types';

import {RawSpanType, SpanEntry} from '../spans/types';

import {ResourceLink} from './resources';
import {TraceContextSpanProxy} from './spanEvidence';

const ALL_INCLUSIVE_RESOURCE_LINKS: ResourceLink[] = [
  {
    text: t('Sentry Docs: N+1 Queries'),
    link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/n-one-queries/',
  },
];

const RESOURCES_DESCRIPTIONS: Record<IssueType, string> = {
  [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: t(
    "N+1 queries are extraneous queries (N) caused by a single, initial query (+1). In the Span Evidence above, we've identified the parent span where the extraneous spans are located and the extraneous spans themselves. To learn more about how to fix N+1 problems, check out these resources:"
  ),
  [IssueType.ERROR]: '',
};

type PlatformSpecificResources = Partial<Record<PlatformType, ResourceLink[]>>;

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
  [IssueType.ERROR]: {},
};

export function getResourceDescription(issueType: IssueType): string {
  return RESOURCES_DESCRIPTIONS[issueType];
}

export function getResourceLinks(
  issueType: IssueType,
  platform: PlatformType | undefined
): ResourceLink[] {
  if (!platform || !RESOURCE_LINKS[issueType] || !RESOURCE_LINKS[issueType][platform]) {
    return ALL_INCLUSIVE_RESOURCE_LINKS;
  }

  return [...ALL_INCLUSIVE_RESOURCE_LINKS, ...RESOURCE_LINKS[issueType][platform]!];
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
  const spanEntry = event.entries.find((entry: SpanEntry | any): entry is SpanEntry => {
    return entry.type === EntryType.SPANS;
  });
  const spans: Array<RawSpanType | TraceContextSpanProxy> = [...spanEntry?.data] ?? [];

  if (event?.contexts?.trace && event?.contexts?.trace?.span_id) {
    // TODO: Fix this conditional and check if span_id is ever actually undefined.
    spans.push(event.contexts.trace as TraceContextSpanProxy);
  }
  const spansById = keyBy(spans, 'span_id');

  const parentSpan = spansById[event.perfProblem.parentSpanIds[0]];
  const repeatingSpan = spansById[event.perfProblem.offenderSpanIds[0]];

  const affectedSpanIds = [parentSpan.span_id, ...event.perfProblem.offenderSpanIds];

  return {parentSpan, repeatingSpan, affectedSpanIds};
}
