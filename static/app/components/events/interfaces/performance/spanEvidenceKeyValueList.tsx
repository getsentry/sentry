import kebabCase from 'lodash/kebabCase';
import mapValues from 'lodash/mapValues';

import {t} from 'sentry/locale';
import {IssueType, KeyValueListData, KeyValueListDataItem} from 'sentry/types';

import KeyValueList from '../keyValueList';
import {RawSpanType} from '../spans/types';

import {TraceContextSpanProxy} from './spanEvidence';

type Span = (RawSpanType | TraceContextSpanProxy) & {
  data?: any;
};

type SpanEvidenceKeyValueListProps = {
  causeSpans: Span[] | null;
  issueType: IssueType | undefined;
  offendingSpans: Span[];
  parentSpan: Span | null;
  transactionName: string;
};

const TEST_ID_NAMESPACE = 'span-evidence-key-value-list';

export function SpanEvidenceKeyValueList(props: SpanEvidenceKeyValueListProps) {
  if (!props.issueType) {
    return <DefaultSpanEvidence {...props} />;
  }

  const Component =
    {
      [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: NPlusOneDBQueriesSpanEvidence,
      [IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS]: NPlusOneAPICallsSpanEvidence,
      [IssueType.PERFORMANCE_SLOW_SPAN]: SlowSpanSpanEvidence,
      [IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES]: ConsecutiveDBQueriesSpanEvidence,
    }[props.issueType] ?? DefaultSpanEvidence;

  return <Component {...props} />;
}

const ConsecutiveDBQueriesSpanEvidence = ({
  transactionName,
  causeSpans,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={
      [
        makeTransactionNameRow(transactionName),
        causeSpans
          ? makeRow(t('Starting Span'), getSpanEvidenceValue(causeSpans[0]))
          : null,
        ...offendingSpans.map(span =>
          makeRow(t('Parallelizable Span'), getSpanEvidenceValue(span))
        ),
      ].filter(Boolean) as KeyValueListData
    }
  />
);

const NPlusOneDBQueriesSpanEvidence = ({
  transactionName,
  parentSpan,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={
      [
        makeTransactionNameRow(transactionName),
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
  transactionName,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => {
  const problemParameters = formatChangingQueryParameters(offendingSpans);

  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(transactionName),
          makeRow(
            t('Repeating Spans (%s)', offendingSpans.length),
            getSpanEvidenceValue(offendingSpans[0])
          ),
          problemParameters.length > 0
            ? makeRow(t('Problem Parameter'), problemParameters)
            : null,
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
};

const SlowSpanSpanEvidence = ({
  transactionName,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={[
      makeTransactionNameRow(transactionName),
      makeRow(t('Slow Span'), getSpanEvidenceValue(offendingSpans[0])),
    ]}
  />
);

const DefaultSpanEvidence = ({
  transactionName,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => (
  <PresortedKeyValueList
    data={[
      makeTransactionNameRow(transactionName),
      makeRow(t('Offending Span'), getSpanEvidenceValue(offendingSpans[0])),
    ]}
  />
);

const PresortedKeyValueList = ({data}: {data: KeyValueListData}) => (
  <KeyValueList isSorted={false} data={data} />
);

const makeTransactionNameRow = (transactionName: string) =>
  makeRow(t('Transaction'), transactionName);

const makeRow = (
  subject: KeyValueListDataItem['subject'],
  value: KeyValueListDataItem['value']
): KeyValueListDataItem => {
  const itemKey = kebabCase(subject);

  return {
    key: itemKey,
    subject,
    value,
    subjectDataTestId: `${TEST_ID_NAMESPACE}.${itemKey}`,
  };
};

function getSpanEvidenceValue(span: Span | null) {
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
function formatChangingQueryParameters(spans: Span[]): string {
  const URLs = spans
    .map(extractSpanURLString)
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

  return pairs.join(' ');
}

const extractSpanURLString = (span: Span): URL | null => {
  try {
    let URLString = span?.data?.url;
    if (!URLString) {
      const [_method, _url] = (span?.description ?? '').split(' ', 2);
      URLString = _url;
    }

    return new URL(URLString);
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
