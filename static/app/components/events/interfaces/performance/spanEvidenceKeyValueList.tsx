import {t} from 'sentry/locale';
import {KeyValueListData} from 'sentry/types';

import KeyValueList from '../keyValueList';
import {RawSpanType} from '../spans/types';

import {TraceContextSpanProxy} from './spanEvidence';

type SpanEvidenceKeyValueListProps = {
  parentSpan: RawSpanType | TraceContextSpanProxy;
  repeatingSpan: RawSpanType | TraceContextSpanProxy;
  transactionName: string;
};

export function SpanEvidenceKeyValueList({
  transactionName,
  parentSpan,
  repeatingSpan,
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
      subject: t('Repeating Span'),
      value: getSpanEvidenceValue(repeatingSpan),
    },
  ];

  return <KeyValueList data={data} />;
}

function getSpanEvidenceValue(span: RawSpanType | TraceContextSpanProxy) {
  if (!span.op && !span.description) {
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
