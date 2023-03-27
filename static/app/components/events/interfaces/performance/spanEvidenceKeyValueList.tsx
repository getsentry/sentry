import {Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';
import kebabCase from 'lodash/kebabCase';
import mapValues from 'lodash/mapValues';

import {Button} from 'sentry/components/button';
import ClippedBox from 'sentry/components/clippedBox';
import {getSpanInfoFromTransactionEvent} from 'sentry/components/events/interfaces/performance/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Link from 'sentry/components/links/link';
import {toRoundedPercent} from 'sentry/components/performance/waterfall/utils';
import {t} from 'sentry/locale';
import {
  Entry,
  EntryRequest,
  EntryType,
  Event,
  EventTransaction,
  IssueType,
  KeyValueListData,
  KeyValueListDataItem,
} from 'sentry/types';
import {formatBytesBase2} from 'sentry/utils';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import useOrganization from 'sentry/utils/useOrganization';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getPerformanceDuration} from 'sentry/views/performance/utils';

import KeyValueList from '../keyValueList';
import {RawSpanType} from '../spans/types';

import {TraceContextSpanProxy} from './spanEvidence';

type Span = (RawSpanType | TraceContextSpanProxy) & {
  data?: any;
  start_timestamp?: number;
  timestamp?: number;
};

type SpanEvidenceKeyValueListProps = {
  causeSpans: Span[];
  event: EventTransaction;
  offendingSpans: Span[];
  orgSlug: string;
  parentSpan: Span | null;
  projectSlug?: string;
};

const TEST_ID_NAMESPACE = 'span-evidence-key-value-list';

export function SpanEvidenceKeyValueList({
  event,
  projectSlug,
}: {
  event: EventTransaction;
  projectSlug?: string;
}) {
  const {slug: orgSlug} = useOrganization();
  const spanInfo = getSpanInfoFromTransactionEvent(event);
  const performanceProblem = event?.perfProblem;

  if (!performanceProblem?.issueType || !spanInfo) {
    return (
      <DefaultSpanEvidence
        event={event}
        offendingSpans={[]}
        causeSpans={[]}
        parentSpan={null}
        orgSlug={orgSlug}
        projectSlug={projectSlug}
      />
    );
  }

  const Component =
    {
      [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: NPlusOneDBQueriesSpanEvidence,
      [IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS]: NPlusOneAPICallsSpanEvidence,
      [IssueType.PERFORMANCE_SLOW_DB_QUERY]: SlowDBQueryEvidence,
      [IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: ConsecutiveDBQueriesSpanEvidence,
      [IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET]: RenderBlockingAssetSpanEvidence,
      [IssueType.PERFORMANCE_UNCOMPRESSED_ASSET]: UncompressedAssetSpanEvidence,
      [IssueType.PERFORMANCE_CONSECUTIVE_HTTP]: ConsecutiveHTTPSpanEvidence,
    }[performanceProblem.issueType] ?? DefaultSpanEvidence;

  return (
    <ClippedBox clipHeight={300}>
      <Component
        event={event}
        orgSlug={orgSlug}
        projectSlug={projectSlug}
        {...spanInfo}
      />
    </ClippedBox>
  );
}

const ConsecutiveDBQueriesSpanEvidence = ({
  event,
  causeSpans,
  offendingSpans,
  orgSlug,
  projectSlug,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={
      [
        makeTransactionNameRow(event, orgSlug, projectSlug),
        causeSpans
          ? makeRow(t('Starting Span'), getSpanEvidenceValue(causeSpans[0]))
          : null,
        makeRow('Parallelizable Spans', offendingSpans.map(getSpanEvidenceValue)),
        makeRow(
          t('Duration Impact'),
          getDurationImpact(event, getConsecutiveDbTimeSaved(causeSpans, offendingSpans))
        ),
      ].filter(Boolean) as KeyValueListData
    }
  />
);

const ConsecutiveHTTPSpanEvidence = ({
  event,
  offendingSpans,
  orgSlug,
  projectSlug,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={
      [
        makeTransactionNameRow(event, orgSlug, projectSlug),
        makeRow(
          'Offending Spans',
          offendingSpans.map(span => span.description)
        ),
      ].filter(Boolean) as KeyValueListData
    }
  />
);

const NPlusOneDBQueriesSpanEvidence = ({
  event,
  causeSpans,
  parentSpan,
  offendingSpans,
  orgSlug,
  projectSlug,
}: SpanEvidenceKeyValueListProps) => {
  const dbSpans = offendingSpans.filter(span => (span.op || '').startsWith('db'));
  const repeatingSpanRows = dbSpans
    .filter(span => offendingSpans.find(s => s.hash === span.hash) === span)
    .map((span, i) =>
      makeRow(
        i === 0 ? t('Repeating Spans (%s)', dbSpans.length) : '',
        getSpanEvidenceValue(span)
      )
    );

  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event, orgSlug, projectSlug),
          parentSpan ? makeRow(t('Parent Span'), getSpanEvidenceValue(parentSpan)) : null,
          causeSpans.length > 0
            ? makeRow(t('Preceding Span'), getSpanEvidenceValue(causeSpans[0]))
            : null,
          ...repeatingSpanRows,
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
};

const NPlusOneAPICallsSpanEvidence = ({
  event,
  offendingSpans,
  orgSlug,
  projectSlug,
}: SpanEvidenceKeyValueListProps) => {
  const requestEntry = event?.entries?.find(isRequestEntry);
  const baseURL = requestEntry?.data?.url;

  const problemParameters = formatChangingQueryParameters(offendingSpans, baseURL);
  const commonPathPrefix = formatBasePath(offendingSpans[0], baseURL);

  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event, orgSlug, projectSlug),
          commonPathPrefix
            ? makeRow(
                t('Repeating Spans (%s)', offendingSpans.length),
                <pre className="val-string">
                  <AnnotatedText
                    value={
                      <Fragment>
                        {commonPathPrefix}
                        <HighlightedEvidence>[Parameters]</HighlightedEvidence>
                      </Fragment>
                    }
                  />
                </pre>
              )
            : null,
          problemParameters.length > 0
            ? makeRow(t('Parameters'), problemParameters)
            : null,
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
};

const HighlightedEvidence = styled('span')`
  color: ${p => p.theme.errorText};
`;

const isRequestEntry = (entry: Entry): entry is EntryRequest => {
  return entry.type === EntryType.REQUEST;
};

const SlowDBQueryEvidence = ({
  event,
  offendingSpans,
  orgSlug,
  projectSlug,
}: SpanEvidenceKeyValueListProps) => {
  return (
    <PresortedKeyValueList
      data={[
        makeTransactionNameRow(event, orgSlug, projectSlug),
        makeRow(t('Slow DB Query'), getSpanEvidenceValue(offendingSpans[0])),
        makeRow(
          t('Duration Impact'),
          getSingleSpanDurationImpact(event, offendingSpans[0])
        ),
      ]}
    />
  );
};

const RenderBlockingAssetSpanEvidence = ({
  event,
  offendingSpans,
  orgSlug,
  projectSlug,
}: SpanEvidenceKeyValueListProps) => {
  const offendingSpan = offendingSpans[0]; // For render-blocking assets, there is only one offender

  return (
    <PresortedKeyValueList
      data={[
        makeTransactionNameRow(event, orgSlug, projectSlug),
        makeRow(t('Slow Resource Span'), getSpanEvidenceValue(offendingSpan)),
        makeRow(
          t('FCP Delay'),
          formatDelay(getSpanDuration(offendingSpan), event.measurements?.fcp?.value ?? 0)
        ),
        makeRow(t('Duration Impact'), getSingleSpanDurationImpact(event, offendingSpan)),
      ]}
    />
  );
};

const UncompressedAssetSpanEvidence = ({
  event,
  offendingSpans,
  orgSlug,
  projectSlug,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={[
      makeTransactionNameRow(event, orgSlug, projectSlug),
      makeRow(t('Slow Resource Span'), getSpanEvidenceValue(offendingSpans[0])),
      makeRow(t('Asset Size'), getSpanFieldBytes(offendingSpans[0], 'Encoded Body Size')),
      makeRow(
        t('Duration Impact'),
        getSingleSpanDurationImpact(event, offendingSpans[0])
      ),
    ]}
  />
);

const DefaultSpanEvidence = ({
  event,
  offendingSpans,
  orgSlug,
  projectSlug,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={
      [
        makeTransactionNameRow(event, orgSlug, projectSlug),
        offendingSpans.length > 0
          ? makeRow(t('Offending Span'), getSpanEvidenceValue(offendingSpans[0]))
          : null,
      ].filter(Boolean) as KeyValueListData
    }
  />
);

const PresortedKeyValueList = ({data}: {data: KeyValueListData}) => (
  <KeyValueList shouldSort={false} data={data} />
);

const makeTransactionNameRow = (event: Event, orgSlug: string, projectSlug?: string) => {
  const transactionSummaryLocation = transactionSummaryRouteWithQuery({
    orgSlug,
    projectID: event.projectID,
    transaction: event.title,
    query: {},
  });

  const eventSlug = generateEventSlug({
    id: event.eventID,
    project: projectSlug,
  });

  const eventDetailsLocation = getTransactionDetailsUrl(orgSlug, eventSlug);

  const actionButton = projectSlug ? (
    <Button size="xs" to={eventDetailsLocation}>
      {t('View Full Event')}
    </Button>
  ) : undefined;

  return makeRow(
    t('Transaction'),
    <pre>
      <Link to={transactionSummaryLocation}>{event.title}</Link>
    </pre>,
    actionButton
  );
};

const makeRow = (
  subject: KeyValueListDataItem['subject'],
  value: KeyValueListDataItem['value'] | KeyValueListDataItem['value'][],
  actionButton?: ReactNode
): KeyValueListDataItem => {
  const itemKey = kebabCase(subject);

  return {
    key: itemKey,
    subject,
    value,
    subjectDataTestId: `${TEST_ID_NAMESPACE}.${itemKey}`,
    isMultiValue: Array.isArray(value),
    actionButton,
  };
};

function getSpanEvidenceValue(span: Span | null): string {
  if (!span || (!span.op && !span.description)) {
    return t('(no value)');
  }

  if (!span.op && span.description) {
    return span.description;
  }

  if (span.op && !span.description) {
    return span.op;
  }

  return `${span.op} - ${span.description}`;
}

const getConsecutiveDbTimeSaved = (
  consecutiveSpans: Span[],
  independentSpans: Span[]
): number => {
  const totalDuration = sumSpanDurations(consecutiveSpans);
  const maxIndependentSpanDuration = Math.max(
    ...independentSpans.map(span => getSpanDuration(span))
  );
  const independentSpanIds = independentSpans.map(span => span.span_id);

  let sumOfDependentSpansDuration = 0;
  consecutiveSpans.forEach(span => {
    if (!independentSpanIds.includes(span.span_id)) {
      sumOfDependentSpansDuration += getSpanDuration(span);
    }
  });

  return (
    totalDuration - Math.max(maxIndependentSpanDuration, sumOfDependentSpansDuration)
  );
};

const sumSpanDurations = (spans: Span[]) => {
  let totalDuration = 0;
  spans.forEach(span => {
    totalDuration += getSpanDuration(span);
  });
  return totalDuration;
};

const getSpanDuration = ({timestamp, start_timestamp}: Span) => {
  return ((timestamp ?? 0) - (start_timestamp ?? 0)) * 1000;
};

function getDurationImpact(event: EventTransaction, durationAdded: number) {
  const transactionTime = (event.endTimestamp - event.startTimestamp) * 1000;
  if (!transactionTime) {
    return null;
  }

  return formatDurationImpact(durationAdded, transactionTime);
}

function formatDurationImpact(durationAdded: number, totalDuration: number) {
  const percent = durationAdded / totalDuration;

  return `${toRoundedPercent(percent)} (${getPerformanceDuration(
    durationAdded
  )}/${getPerformanceDuration(totalDuration)})`;
}

function formatDelay(durationAdded: number, totalDuration: number) {
  const percent = durationAdded / totalDuration;

  return `${getPerformanceDuration(durationAdded)} (${toRoundedPercent(
    percent
  )} of ${getPerformanceDuration(totalDuration)})`;
}

function getSingleSpanDurationImpact(event: EventTransaction, span: Span) {
  return getDurationImpact(event, getSpanDuration(span));
}

function getSpanDataField(span: Span, field: string) {
  return span.data?.[field];
}

function getSpanFieldBytes(span: Span, field: string) {
  const bytes = getSpanDataField(span, field);
  if (!bytes) {
    return null;
  }
  return `${formatBytesBase2(bytes)} (${bytes} B)`;
}

type ParameterLookup = Record<string, string[]>;

/** Extracts changing URL query parameters from a list of `http.client` spans.
 * e.g.,
 *
 * https://service.io/r?id=1&filter=none
 * https://service.io/r?id=2&filter=none
 * https://service.io/r?id=3&filter=none

  * @returns A condensed string describing the query parameters changing
  * between the URLs of the given span. e.g., "id:{1,2,3}"
 */
function formatChangingQueryParameters(spans: Span[], baseURL?: string): string[] {
  const URLs = spans
    .map(span => extractSpanURLString(span, baseURL))
    .filter((url): url is URL => url instanceof URL);

  const allQueryParameters = extractQueryParameters(URLs);

  const pairs: string[] = [];
  for (const key in allQueryParameters) {
    const values = allQueryParameters[key];

    // By definition, if the parameter only has one value that means it's not
    // changing between calls, so omit it!
    if (values.length > 1) {
      pairs.push(`${key}:{${values.join(',')}}`);
    }
  }

  return pairs;
}

/** Parses the span data and pulls out the URL. Accounts for different SDKs and
     different versions of SDKs formatting and parsing the URL contents
     differently. Mirror of `get_url_from_span`. Ideally, this should not exist,
     and instead it should use the data provided by the backend */
export const extractSpanURLString = (span: Span, baseURL?: string): URL | null => {
  let URLString;

  URLString = span?.data?.url;
  if (URLString) {
    try {
      let url = span?.data?.url ?? '';
      const query = span?.data?.['http.query'];
      if (query) {
        url += `?${query}`;
      }

      return new URL(url, baseURL);
    } catch (e) {
      // Ignore error
    }
  }

  const [_method, _url] = (span?.description ?? '').split(' ', 2);
  URLString = _url;

  try {
    return new URL(_url, baseURL);
  } catch (e) {
    // Ignore error
  }

  return null;
};

export function extractQueryParameters(URLs: URL[]): ParameterLookup {
  const parameterValuesByKey: ParameterLookup = {};

  URLs.forEach(url => {
    for (const [key, value] of url.searchParams) {
      parameterValuesByKey[key] ??= [];
      parameterValuesByKey[key].push(value);
    }
  });

  return mapValues(parameterValuesByKey, parameterList => {
    return Array.from(new Set(parameterList));
  });
}

function formatBasePath(span: Span, baseURL?: string): string {
  const spanURL = extractSpanURLString(span, baseURL);

  return spanURL?.pathname ?? '';
}
