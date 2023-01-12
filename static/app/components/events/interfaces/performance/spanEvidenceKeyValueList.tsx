import {t} from 'sentry/locale';
import {IssueType, KeyValueListData} from 'sentry/types';

import KeyValueList from '../keyValueList';
import {RawSpanType} from '../spans/types';

import {TraceContextSpanProxy} from './spanEvidence';

type SpanEvidenceKeyValueListProps = {
  issueType: IssueType;
  offendingSpans: Array<RawSpanType | TraceContextSpanProxy>;
  parentSpan: RawSpanType | TraceContextSpanProxy | null;
  transactionName: string;
};

const TEST_ID_NAMESPACE = 'span-evidence-key-value-list';

export function SpanEvidenceKeyValueList({
  issueType,
  transactionName,
  parentSpan,
  offendingSpans,
}: SpanEvidenceKeyValueListProps) {
  const data: KeyValueListData = [
    {
      key: '0',
      subject: t('Transaction'),
      value: transactionName,
      subjectDataTestId: `${TEST_ID_NAMESPACE}.transaction-name`,
    },
  ];

  if (
    [
      IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
      IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD,
    ].includes(issueType)
  ) {
    data.push({
      key: '1',
      subject: t('Parent Span'),
      value: getSpanEvidenceValue(parentSpan),
      subjectDataTestId: `${TEST_ID_NAMESPACE}.parent-name`,
    });
  }

  data.push({
    key: '2',
    subject:
      issueType === IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES
        ? t('Repeating Span')
        : t('Offending Span'),
    value: getSpanEvidenceValue(offendingSpans[0]),
    subjectDataTestId: `${TEST_ID_NAMESPACE}.offending-spans`,
  });

  let problemParameters;
  if (issueType === IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS) {
    problemParameters = getProblemParameters(offendingSpans);
  }

  if (problemParameters?.length > 0) {
    data.push({
      key: '3',
      subject: t('Problem Parameter'),
      value: problemParameters,
      subjectDataTestId: `${TEST_ID_NAMESPACE}.problem-parameters`,
    });
  }

  return <KeyValueList data={data} />;
}

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
