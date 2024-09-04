import styled from '@emotion/styled';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import TraceView from '../spans/traceView';
import WaterfallModel from '../spans/waterfallModel';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

interface EventTraceViewInnerProps {
  event: Event;
  organization: Organization;
  projectSlug: string;
}

// Find a chain of affected span ids from transaction.children that contain the error span
// Transaction children contain more children, so we need to recursively search for the error span
function findAffectedSpanIds(
  eventId: string,
  transactions: TraceTree.Transaction[],
  parentSpanIds: string[] = []
): string[] | undefined {
  for (const transaction of transactions) {
    const newParentSpanIds = [...parentSpanIds, transaction.span_id];
    if (transaction.errors.some(error => error.event_id === eventId)) {
      return newParentSpanIds;
    }

    for (const span of transaction.children) {
      const newChildSpanIds = [...newParentSpanIds, span.span_id];
      const result = findAffectedSpanIds(eventId, span.children, newChildSpanIds);
      if (result) {
        return result;
      }
    }
  }

  return undefined;
}

function EventTraceViewInner({
  event,
  organization,
  projectSlug,
}: EventTraceViewInnerProps) {
  // Assuming profile exists, should be checked in the parent component
  const profileId = event.contexts.trace!.trace_id!;
  const trace = useTrace({
    traceSlug: profileId ? profileId : undefined,
    limit: 10000,
  });
  const {data: rootEvent, isPending} = useTraceRootEvent(trace.data ?? null);

  if (trace.isPending || isPending || !rootEvent) {
    return null;
  }

  // Find affected span ids in the trace
  const affectedSpanIds = findAffectedSpanIds(
    event.eventID,
    trace.data?.transactions ?? []
  )?.slice(1);

  console.log(rootEvent);
  const spanEntires = rootEvent?.entries.find(entry => entry.type === 'spans');
  const actualAffectedSpanIds = (spanEntires?.data as RawSpanType[])?.map(
    span => span.span_id
  );
  return (
    <InterimSection type={SectionKey.TRACE} title={t('Trace Preview')}>
      <SpanEvidenceKeyValueList event={rootEvent} projectSlug={projectSlug} />
      <ProfilesProvider
        orgSlug={organization.slug}
        projectSlug={projectSlug}
        profileId={profileId || ''}
      >
        <ProfileContext.Consumer>
          {profiles => (
            <ProfileGroupProvider
              type="flamechart"
              input={profiles?.type === 'resolved' ? profiles.data : null}
              traceID={profileId || ''}
            >
              <TraceViewWrapper>
                <TraceView
                  organization={organization}
                  waterfallModel={
                    new WaterfallModel(rootEvent, affectedSpanIds, affectedSpanIds)
                  }
                  isEmbedded
                />
              </TraceViewWrapper>
            </ProfileGroupProvider>
          )}
        </ProfileContext.Consumer>
      </ProfilesProvider>
    </InterimSection>
  );
}

interface EventTraceViewProps extends EventTraceViewInnerProps {
  group: Group;
}

export function EventTraceView({
  group,
  event,
  organization,
  projectSlug,
}: EventTraceViewProps) {
  // Check trace id exists
  if (!event || !event.contexts.trace?.trace_id) {
    return null;
  }

  const hasProfilingFeature = organization.features.includes('profiling');
  if (!hasProfilingFeature) {
    return null;
  }

  // Only display this for error or default events since performance events are handled elsewhere
  if (group.issueCategory === IssueCategory.PERFORMANCE) {
    return null;
  }

  return (
    <EventTraceViewInner
      event={event}
      organization={organization}
      projectSlug={projectSlug}
    />
  );
}

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
