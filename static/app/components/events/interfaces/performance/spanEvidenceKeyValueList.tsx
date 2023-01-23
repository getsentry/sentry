import kebabCase from 'lodash/kebabCase';
import mapValues from 'lodash/mapValues';

import {getSpanInfoFromTransactionEvent} from 'sentry/components/events/interfaces/performance/utils';
import {toPercent} from 'sentry/components/performance/waterfall/utils';
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
  parentSpan: Span | null;
};

const TEST_ID_NAMESPACE = 'span-evidence-key-value-list';

export function SpanEvidenceKeyValueList({event}: {event: EventTransaction}) {
  const spanInfo = getSpanInfoFromTransactionEvent(event);
  const performanceProblem = event?.perfProblem;

  if (!performanceProblem?.issueType || !spanInfo) {
    return (
      <DefaultSpanEvidence
        event={event}
        offendingSpans={[]}
        causeSpans={[]}
        parentSpan={null}
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
    }[performanceProblem.issueType] ?? DefaultSpanEvidence;

  return <Component event={event} {...spanInfo} />;
}

const ConsecutiveDBQueriesSpanEvidence = ({
  event,
  causeSpans,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={
      [
        makeTransactionNameRow(event),
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

const NPlusOneDBQueriesSpanEvidence = ({
  event,
  parentSpan,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={
      [
        makeTransactionNameRow(event),
        parentSpan ? makeRow(t('Parent Span'), getSpanEvidenceValue(parentSpan)) : null,
        makeRow(
          t('Repeating Spans (%s)', offendingSpans.length),
          getSpanEvidenceValue(offendingSpans[0])
        ),
      ].filter(Boolean) as KeyValueListData
    }
  />
);

const NPlusOneAPICallsSpanEvidence = ({
  event,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => {
  const requestEntry = event?.entries?.find(isRequestEntry);
  const baseURL = requestEntry?.data?.url;

  const problemParameters = formatChangingQueryParameters(offendingSpans, baseURL);
  const commonPathPrefix = formatBasePath(offendingSpans[0], baseURL);

  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(event),
          commonPathPrefix
            ? makeRow(t('Repeating Spans (%s)', offendingSpans.length), commonPathPrefix)
            : null,
          problemParameters.length > 0
            ? makeRow(t('Parameters'), problemParameters)
            : null,
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
};

const isRequestEntry = (entry: Entry): entry is EntryRequest => {
  return entry.type === EntryType.REQUEST;
};

const SlowDBQueryEvidence = ({event, offendingSpans}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={[
      makeTransactionNameRow(event),
      makeRow(t('Slow DB Query'), getSpanEvidenceValue(offendingSpans[0])),
    ]}
  />
);

const RenderBlockingAssetSpanEvidence = ({
  event,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={[
      makeTransactionNameRow(event),
      makeRow(t('Slow Resource Span'), getSpanEvidenceValue(offendingSpans[0])),
    ]}
  />
);

const UncompressedAssetSpanEvidence = ({
  event,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={[
      makeTransactionNameRow(event),
      makeRow(t('Slow Resource Span'), getSpanEvidenceValue(offendingSpans[0])),
      makeRow(t('Asset Size'), getSpanFieldBytes(offendingSpans[0], 'Encoded Body Size')),
      makeRow(
        t('Duration Impact'),
        getSingleSpanDurationImpact(event, offendingSpans[0])
      ),
    ]}
  />
);

const DefaultSpanEvidence = ({event, offendingSpans}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={
      [
        makeTransactionNameRow(event),
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

const makeTransactionNameRow = (event: Event) => makeRow(t('Transaction'), event.title);

const makeRow = (
  subject: KeyValueListDataItem['subject'],
  value: KeyValueListDataItem['value'] | KeyValueListDataItem['value'][]
): KeyValueListDataItem => {
  const itemKey = kebabCase(subject);

  return {
    key: itemKey,
    subject,
    value,
    subjectDataTestId: `${TEST_ID_NAMESPACE}.${itemKey}`,
    isMultiValue: Array.isArray(value),
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
  return timestamp && start_timestamp ? (timestamp - start_timestamp) * 1000 : 0;
};

function getDurationImpact(event: EventTransaction, durationAdded: number) {
  const transactionTime = (event.endTimestamp - event.startTimestamp) * 1000;
  if (!transactionTime) {
    return null;
  }
  const percent = durationAdded / transactionTime;
  return `${toPercent(percent)} (${getPerformanceDuration(
    durationAdded
  )}/${getPerformanceDuration(transactionTime)})`;
}

function getSingleSpanDurationImpact(event: EventTransaction, span: Span) {
  if (
    typeof span.timestamp === 'undefined' ||
    typeof span.start_timestamp === 'undefined'
  ) {
    return null;
  }
  const spanTime = span?.timestamp - span?.start_timestamp;
  return getDurationImpact(event, spanTime * 1000);
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

const extractSpanURLString = (span: Span, baseURL?: string): URL | null => {
  try {
    let URLString = span?.data?.url;
    if (!URLString) {
      const [_method, _url] = (span?.description ?? '').split(' ', 2);
      URLString = _url;
    }

    return new URL(URLString, baseURL);
  } catch (e) {
    return null;
  }
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
