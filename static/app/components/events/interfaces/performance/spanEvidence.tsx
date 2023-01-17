import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {EventTransaction, IssueType, Organization} from 'sentry/types';

import {DataSection} from '../../eventTagsAndScreenshot/dataSection';
import TraceView from '../spans/traceView';
import {TraceContextType} from '../spans/types';
import WaterfallModel from '../spans/waterfallModel';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';
import {getSpanInfoFromTransactionEvent} from './utils';

interface Props {
  event: EventTransaction;
  issueType: IssueType;
  organization: Organization;
}

export type TraceContextSpanProxy = Omit<TraceContextType, 'span_id'> & {
  span_id: string; // TODO: Remove this temporary type.
};

export function SpanEvidenceSection({event, issueType, organization}: Props) {
  const spanInfo = getSpanInfoFromTransactionEvent(event);

  if (!spanInfo) {
    return null;
  }

  const {causeSpans, parentSpan, offendingSpans, affectedSpanIds} = spanInfo;

  return (
    <DataSection
      title={t('Span Evidence')}
      description={t(
        'Span Evidence identifies the root cause of this issue, found in other similar events within the same issue.'
      )}
    >
      <SpanEvidenceKeyValueList
        issueType={issueType}
        transactionName={event.title}
        parentSpan={parentSpan}
        offendingSpans={offendingSpans}
        causeSpans={causeSpans}
      />

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

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
