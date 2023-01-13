import {t} from 'sentry/locale';
import {IssueType, KeyValueListData} from 'sentry/types';

import KeyValueList from '../keyValueList';
import {RawSpanType} from '../spans/types';

import {TraceContextSpanProxy} from './spanEvidence';

type SpanEvidenceKeyValueListProps = {
  issueType: IssueType | undefined;
  offendingSpans: Array<RawSpanType | TraceContextSpanProxy>;
  parentSpan: RawSpanType | TraceContextSpanProxy | null;
  transactionName: string;
};

const TEST_ID_NAMESPACE = 'span-evidence-key-value-list';

export function SpanEvidenceKeyValueList(props: SpanEvidenceKeyValueListProps) {
  const {issueType} = props;

  if (issueType === IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES) {
    return <NPlusOneDBQueriesSpanEvidence {...props} />;
  }

  if (issueType === IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS) {
    return <NPlusOneAPICallsSpanEvidence {...props} />;
  }

  if (issueType === IssueType.PERFORMANCE_SLOW_SPAN) {
    return <SlowSpanSpanEvidence {...props} />;
  }

  return <DefaultSpanEvidence {...props} />;
}

const NPlusOneDBQueriesSpanEvidence = ({offendingSpans, parentSpan, transactionName}) => (
  <KeyValueList
    data={
      [
        {
          key: 'transaction-name',
          subject: t('Transaction'),
          value: transactionName,
          subjectDataTestId: `${TEST_ID_NAMESPACE}.transaction-name`,
        },
        {
          key: 'parent-span',
          subject: t('Parent Span'),
          value: getSpanEvidenceValue(parentSpan),
          subjectDataTestId: `${TEST_ID_NAMESPACE}.parent-name`,
        },
        {
          key: 'repeating-span',
          subject: t('Repeating Span'),
          value: getSpanEvidenceValue(offendingSpans[0]),
          subjectDataTestId: `${TEST_ID_NAMESPACE}.offending-spans`,
        },
      ].filter(Boolean) as KeyValueListData
    }
  />
);

const NPlusOneAPICallsSpanEvidence = ({offendingSpans, transactionName}) => {
  const problemParameters = getProblemParameters(offendingSpans);

  return (
    <KeyValueList
      data={
        [
          {
            key: 'transaction-name',
            subject: t('Transaction'),
            value: transactionName,
            subjectDataTestId: `${TEST_ID_NAMESPACE}.transaction-name`,
          },
          {
            key: 'repeating-span',
            subject: t('Offending Span'),
            value: getSpanEvidenceValue(offendingSpans[0]),
            subjectDataTestId: `${TEST_ID_NAMESPACE}.offending-spans`,
          },
          getProblemParameters.length > 0 && {
            key: 'problem-parameter',
            subject: t('Problem Parameter'),
            value: problemParameters,
            subjectDataTestId: `${TEST_ID_NAMESPACE}.problem-parameters`,
          },
        ].filter(Boolean) as KeyValueListData
      }
    />
  );
};

const SlowSpanSpanEvidence = ({offendingSpans, transactionName}) => (
  <KeyValueList
    data={
      [
        {
          key: 'transaction-name',
          subject: t('Transaction'),
          value: transactionName,
          subjectDataTestId: `${TEST_ID_NAMESPACE}.transaction-name`,
        },
        {
          key: 'slow-span',
          subject: t('Slow Span'),
          value: getSpanEvidenceValue(offendingSpans[0]),
          subjectDataTestId: `${TEST_ID_NAMESPACE}.offending-spans`,
        },
      ].filter(Boolean) as KeyValueListData
    }
  />
);

const DefaultSpanEvidence = ({transactionName, offendingSpans}) => (
  <KeyValueList
    data={[
      {
        key: 'transaction-name',
        subject: t('Transaction'),
        value: transactionName,
        subjectDataTestId: `${TEST_ID_NAMESPACE}.transaction-name`,
      },
      {
        key: 'offending-span',
        subject: t('Offending Span'),
        value: getSpanEvidenceValue(offendingSpans[0]),
        subjectDataTestId: `${TEST_ID_NAMESPACE}.offending-spans`,
      },
    ]}
  />
);

function getSpanEvidenceValue(span: RawSpanType | TraceContextSpanProxy | null) {
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
