import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {EventTransaction, IssueType, Organization} from 'sentry/types';

import {DataSection} from '../../eventTagsAndScreenshot/dataSection';
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
  if (event?.perfProblem?.issueType !== IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS) {
    affectedSpanIds.push(...parentSpanIDs);
  }

  return (
    <DataSection
      title={t('Span Evidence')}
      description={t(
        'Span Evidence identifies the root cause of this issue, found in other similar events within the same issue.'
      )}
    >
      <SpanEvidenceKeyValueList event={event} />

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
