import kebabCase from 'lodash/kebabCase';

import {t} from 'sentry/locale';
import {IssueType, KeyValueListData, KeyValueListDataItem} from 'sentry/types';

import KeyValueList from '../keyValueList';
import {RawSpanType} from '../spans/types';

import {TraceContextSpanProxy} from './spanEvidence';

type Span = RawSpanType | TraceContextSpanProxy;

type SpanEvidenceKeyValueListProps = {
  causeSpans: Array<RawSpanType | TraceContextSpanProxy> | null;
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

  console.log(props.issueType);

  const Component =
    {
      [IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES]: NPlusOneDBQueriesSpanEvidence,
      [IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS]: NPlusOneAPICallsSpanEvidence,
      [IssueType.PERFORMANCE_SLOW_SPAN]: SlowSpanSpanEvidence,
      performance_consecutive_db_op: ConsecutiveDBQueriesSpanEvidence,
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
        makeRow(t('Repeating Span'), getSpanEvidenceValue(offendingSpans[0])),
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
        makeRow(t('Repeating Span'), getSpanEvidenceValue(offendingSpans[0])),
      ].filter(Boolean) as KeyValueListData
    }
  />
);

const NPlusOneAPICallsSpanEvidence = ({
  transactionName,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) => {
  const problemParameters = getProblemParameters(offendingSpans);

  return (
    <PresortedKeyValueList
      data={
        [
          makeTransactionNameRow(transactionName),
          makeRow(t('Offending Span'), getSpanEvidenceValue(offendingSpans[0])),
          getProblemParameters.length > 0
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

function getProblemParameters(
  offendingSpans: Array<RawSpanType | TraceContextSpanProxy>
): string[] {
  const uniqueParameterPairs = new Set<string>();

  offendingSpans.forEach(span => {
    // TODO: Look into the span data if possible, not just the description
    // TODO: Find the unique parameter names and values in a better format

    if (!span.description) {
      return;
    }

    const [_method, url] = span.description.split(' ', 2);
    try {
      const parsedURL = new URL(url);

      for (const [key, value] of parsedURL.searchParams) {
        uniqueParameterPairs.add(`${key}=${value}`);
      }
    } catch {
      // Ignore error
    }
  });

  return Array.from(uniqueParameterPairs);
}
