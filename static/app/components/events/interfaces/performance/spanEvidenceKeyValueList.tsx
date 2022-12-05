import {t} from 'sentry/locale';
import {IssueType, KeyValueListData} from 'sentry/types';

import KeyValueList from '../keyValueList';
import {RawSpanType} from '../spans/types';

import {TraceContextSpanProxy} from './spanEvidence';

type SpanEvidenceKeyValueListProps = {
  issueType: IssueType | undefined;
  offendingSpan: RawSpanType | TraceContextSpanProxy | null;
  parentSpan: RawSpanType | TraceContextSpanProxy | null;
  transactionName: string;
};

export function SpanEvidenceKeyValueList({
  issueType,
  transactionName,
  parentSpan,
  offendingSpan,
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
      value: getSpanEvidenceValue(offendingSpan),
    },
  ];

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
