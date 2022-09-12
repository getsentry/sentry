import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, EventTransaction, KeyValueListData, Organization} from 'sentry/types';

import DataSection from '../../eventTagsAndScreenshot/dataSection';
import KeyValueList from '../keyValueList';
import TraceView from '../spans/traceView';
import WaterfallModel from '../spans/waterfallModel';

export type SpanEvidence = {
  parentSpan: string;
  repeatingSpan: string;
  sourceSpan: string;
  transaction: string;
};

interface Props {
  affectedSpanIds: string[];
  event: Event;
  organization: Organization;
  spanEvidence: SpanEvidence;
}

export function SpanEvidenceSection({
  spanEvidence,
  event,
  organization,
  affectedSpanIds,
}: Props) {
  const {transaction, parentSpan, sourceSpan, repeatingSpan} = spanEvidence;

  const data: KeyValueListData = [
    {
      key: '0',
      subject: t('Transaction'),
      value: transaction,
    },
    {
      key: '1',
      subject: t('Parent Span'),
      value: parentSpan,
    },
    {
      key: '2',
      subject: t('Source Span'),
      value: sourceSpan,
    },
    {
      key: '3',
      subject: t('Repeating Span'),
      value: repeatingSpan,
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
          waterfallModel={new WaterfallModel(event as EventTransaction, affectedSpanIds)}
          isEmbedded
        />
      </TraceViewWrapper>
    </DataSection>
  );
}

export const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: 0;
  /* Padding aligns with Layout.Body */
  padding: ${space(3)} ${space(2)} ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(3)} ${space(4)} ${space(3)};
  }
  & h3,
  & h3 a {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    color: ${p => p.theme.gray300};
  }
  & h3 {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    padding: ${space(0.75)} 0;
    margin-bottom: 0;
    text-transform: uppercase;
  }
`;

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
