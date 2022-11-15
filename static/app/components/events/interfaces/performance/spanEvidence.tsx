import styled from '@emotion/styled';

import * as SpanContext from 'sentry/components/events/interfaces/spans/spanContext';
import {t} from 'sentry/locale';
import {EventTransaction, Organization} from 'sentry/types';

import DataSection from '../../eventTagsAndScreenshot/dataSection';
import TraceView from '../spans/traceView';
import {TraceContextType} from '../spans/types';
import WaterfallModel from '../spans/waterfallModel';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';
import {getSpanInfoFromTransactionEvent} from './utils';

interface Props {
  event: EventTransaction;
  organization: Organization;
}

export type TraceContextSpanProxy = Omit<TraceContextType, 'span_id'> & {
  span_id: string; // TODO: Remove this temporary type.
};

export function SpanEvidenceSection({event, organization}: Props) {
  const spanInfo = getSpanInfoFromTransactionEvent(event);

  if (!spanInfo) {
    return null;
  }

  const {parentSpan, repeatingSpan, affectedSpanIds} = spanInfo;

  return (
    <DataSection
      title={t('Span Evidence')}
      description={t(
        'Span Evidence identifies the parent span where the N+1 occurs, and the repeating spans.'
      )}
    >
      <SpanEvidenceKeyValueList
        transactionName={event.title}
        parentSpan={parentSpan}
        repeatingSpan={repeatingSpan}
      />

      <TraceViewWrapper>
        <SpanContext.Provider>
          <TraceView
            organization={organization}
            waterfallModel={
              new WaterfallModel(event as EventTransaction, affectedSpanIds)
            }
            isEmbedded
          />
        </SpanContext.Provider>
      </TraceViewWrapper>
    </DataSection>
  );
}

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
