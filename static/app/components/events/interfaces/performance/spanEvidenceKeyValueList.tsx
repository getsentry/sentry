import {t} from 'sentry/locale';
import {IssueType, KeyValueListData, KeyValueListDataItem} from 'sentry/types';

import KeyValueList from '../keyValueList';
import {RawSpanType} from '../spans/types';

import {TraceContextSpanProxy} from './spanEvidence';

type Span = RawSpanType | TraceContextSpanProxy;

type SpanEvidenceKeyValueListProps = {
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
    }[props.issueType] ?? DefaultSpanEvidence;

  return <Component {...props} />;
}

const NPlusOneDBQueriesSpanEvidence = ({
  transactionName,
  parentSpan,
  offendingSpans,
}: Pick<
  SpanEvidenceKeyValueListProps,
  'transactionName' | 'parentSpan' | 'offendingSpans'
>) => (
  <KeyValueList
    data={
      [
        makeTransactionNameRow(transactionName),
        parentSpan
          ? makeRow('parent-name', t('Parent Span'), getSpanEvidenceValue(parentSpan))
          : null,
        makeRow(
          'offending-spans',
          t('Repeating Span'),
          getSpanEvidenceValue(offendingSpans[0])
        ),
      ].filter(Boolean) as KeyValueListData
    }
  />
);

const NPlusOneAPICallsSpanEvidence = ({
  transactionName,
  offendingSpans,
}: Pick<SpanEvidenceKeyValueListProps, 'transactionName' | 'offendingSpans'>) => {
  const problemParameters = getProblemParameters(offendingSpans);

  return (
    <KeyValueList
      data={
        [
          makeTransactionNameRow(transactionName),
          makeRow(
            'offending-spans',
            t('Offending Span'),
            getSpanEvidenceValue(offendingSpans[0])
          ),
          getProblemParameters.length > 0
            ? makeRow('problem-parameters', t('Problem Parameter'), problemParameters)
            : null,
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
};

const SlowSpanSpanEvidence = ({
  transactionName,
  offendingSpans,
}: Pick<SpanEvidenceKeyValueListProps, 'transactionName' | 'offendingSpans'>) => (
  <KeyValueList
    data={[
      makeTransactionNameRow(transactionName),
      makeRow(
        'offending-spans',
        t('Offending Span'),
        getSpanEvidenceValue(offendingSpans[0])
      ),
      makeRow('slow-span', t('Slow Span'), getSpanEvidenceValue(offendingSpans[0])),
    ]}
  />
);

const DefaultSpanEvidence = ({
  transactionName,
  offendingSpans,
}: Pick<SpanEvidenceKeyValueListProps, 'transactionName' | 'offendingSpans'>) => (
  <KeyValueList
    data={[
      makeTransactionNameRow(transactionName),
      makeRow(
        'offending-spans',
        t('Offending Span'),
        getSpanEvidenceValue(offendingSpans[0])
      ),
    ]}
  />
);

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

const makeTransactionNameRow = (transactionName: string) =>
  makeRow('transaction-name', t('Transaction'), transactionName);

const makeRow = (
  key: KeyValueListDataItem['key'],
  subject: KeyValueListDataItem['subject'],
  value: KeyValueListDataItem['value']
): KeyValueListDataItem => ({
  key,
  subject,
  value,
  subjectDataTestId: `${TEST_ID_NAMESPACE}.${key}`,
});
