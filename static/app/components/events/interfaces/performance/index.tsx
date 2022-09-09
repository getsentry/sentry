import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {EntryType, EventTransaction, KeyValueListData, Organization} from 'sentry/types';

import DataSection from '../../eventTagsAndScreenshot/dataSection';
import KeyValueList from '../keyValueList';
import TraceView from '../spans/traceView';
import {RawSpanType, SpanEntry} from '../spans/types';
import WaterfallModel from '../spans/waterfallModel';

export type SpanEvidence = {
  parentSpan: string;
  repeatingSpan: string;
  sourceSpan: string;
  transaction: string;
};

interface Props {
  event: EventTransaction;
  organization: Organization;
}

export function SpanEvidenceSection({event, organization}: Props) {
  // We won't be able to do this once it is possible to merge Performance Issues, but for now it is fine
  const {causes, offenders, parents} = Object.values(event.performanceDetectorData!)[0];

  // For now, it is safe to assume that there is only one cause and parent span for N+1 issues
  const sourceSpanId = causes[0];
  const parentSpanId = parents[0];
  const repeatingSpanIdSet = new Set(offenders);

  // Let's dive into the event to pick off the span evidence data by using the IDs we know
  const spanEntry = event.entries.find((entry: SpanEntry | any): entry is SpanEntry => {
    return entry.type === EntryType.SPANS;
  });
  const spans: Array<RawSpanType> = spanEntry?.data ?? [];

  const spanEvidence = spans.reduce(
    (acc: SpanEvidence & {affectedSpanIds: string[]}, span) => {
      if (span.span_id === sourceSpanId) {
        acc.sourceSpan = span.description ?? '';
      }

      if (span.span_id === parentSpanId) {
        acc.parentSpan = span.description ?? '';
      }

      if (repeatingSpanIdSet.has(span.span_id)) {
        acc.repeatingSpan = span.description ?? '';
        acc.affectedSpanIds.push(span.span_id);
      }

      return acc;
    },
    {
      transaction: '',
      parentSpan: '',
      sourceSpan: '',
      repeatingSpan: '',
      affectedSpanIds: [],
    }
  );

  const data: KeyValueListData = [
    {
      key: '0',
      subject: t('Transaction'),
      value: spanEvidence.transaction,
    },
    {
      key: '1',
      subject: t('Parent Span'),
      value: spanEvidence.parentSpan,
    },
    {
      key: '2',
      subject: t('Source Span'),
      value: spanEvidence.sourceSpan,
    },
    {
      key: '3',
      subject: t('Repeating Span'),
      value: spanEvidence.repeatingSpan,
    },
  ];

  return (
    <DataSection
      title={t('Span Evidence')}
      description={t(
        'Span Evidence identifies the parent span where the N+1 occurs, the source span that occurs immediately before the repeating spans, and the repeating span itself.'
      )}
    >
      <KeyValueList data={data} />

      <TraceViewWrapper>
        <TraceView
          organization={organization}
          waterfallModel={
            new WaterfallModel(event as EventTransaction, spanEvidence.affectedSpanIds)
          }
          isEmbedded
        />
      </TraceViewWrapper>
    </DataSection>
  );
}

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
