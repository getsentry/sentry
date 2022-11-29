import {t} from 'sentry/locale';
import {KeyValueListData} from 'sentry/types';

import KeyValueList from '../keyValueList';
import {RawSpanType} from '../spans/types';

import {TraceContextSpanProxy} from './spanEvidence';

type SpanEvidenceKeyValueListProps = {
  offendingSpan: RawSpanType | TraceContextSpanProxy | null;
  parentSpan: RawSpanType | TraceContextSpanProxy | null;
  transactionName: string;
};

export function SpanEvidenceKeyValueList({
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
      subject: t('Offending Span'),
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
