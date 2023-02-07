import styled from '@emotion/styled';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {EventTransaction, IssueType, Organization} from 'sentry/types';

import TraceView from '../spans/traceView';
import {TraceContextType} from '../spans/types';
import WaterfallModel from '../spans/waterfallModel';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

interface Props {
  event: EventTransaction;
  organization: Organization;
}

export type TraceContextSpanProxy = Omit<TraceContextType, 'span_id'> & {
  span_id: string; // TODO: Remove this temporary type.
};

export function SpanEvidenceSection({event, organization}: Props) {
  if (!event) {
    return null;
  }

  const parentSpanIDs = event?.perfProblem?.parentSpanIds ?? [];
  const offendingSpanIDs = event?.perfProblem?.offenderSpanIds ?? [];

  const affectedSpanIds = [...offendingSpanIDs];
  const focusedSpanIds: string[] = [];
  const issueType = event?.perfProblem?.issueType;
  if (issueType !== IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS) {
    affectedSpanIds.push(...parentSpanIDs);
  }
  if (issueType === IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES) {
    const consecutiveSpanIds = event?.perfProblem?.causeSpanIds ?? [];

    if (consecutiveSpanIds.length < 11) {
      focusedSpanIds.push(...consecutiveSpanIds);
    }
  }

  return (
    <EventDataSection
      title={t('Span Evidence')}
      type="span-evidence"
      help={t(
        'Span Evidence identifies the root cause of this issue, found in other similar events within the same issue.'
      )}
    >
      <SpanEvidenceKeyValueList event={event} />

      <TraceViewWrapper>
        <TraceView
          organization={organization}
          waterfallModel={
            new WaterfallModel(event as EventTransaction, affectedSpanIds, focusedSpanIds)
          }
          isEmbedded
        />
      </TraceViewWrapper>
    </EventDataSection>
  );
}

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
