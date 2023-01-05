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
    },
    {
      key: '1',
      subject: t('Parent Span'),
      value: getSpanEvidenceValue(parentSpan),
    },
    {
      key: '2',
      subject:
        issueType === IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES
          ? t('Repeating Span')
          : t('Offending Span'),
      value: getSpanEvidenceValue(offendingSpans[0]),
    },
  ];

  const problemParameters = getProblemParameters(offendingSpans);

  if (problemParameters && issueType === IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS) {
    data.push({
      key: '3',
      subject: t('Problem Parameter'),
      value: getProblemParameters(offendingSpans),
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
) {
  const uniqueParameterPairs = new Set();

  offendingSpans.forEach(span => {
    // TODO: Look into the span data if possible, not just the description
    // TODO: Find the unique parameter names and values in a better format

    if (!span.description) {
      return;
    }

    const [_method, url] = span.description.split(' ', 2);
    const parsedURL = new URL(url);

    for (const [key, value] of parsedURL.searchParams) {
      uniqueParameterPairs.add(`${key}=${value}`);
    }
  });

  return Array.from(uniqueParameterPairs);
}
