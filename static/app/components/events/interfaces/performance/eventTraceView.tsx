import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
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

function EventTraceViewInner({
  event,
  organization,
  projectSlug,
}: EventTraceViewInnerProps) {
  // Assuming profile exists, should be checked in the parent component
  const profileId = event.contexts.trace!.trace_id!;
  const trace = useTrace({
    traceSlug: profileId ? profileId : undefined,
  });
  const {data: rootEvent, isPending} = useTraceRootEvent(trace.data ?? null);

  if (isPending || !rootEvent) {
    return null;
  }

  const hasProfilingFeature = organization.features.includes('profiling');

  return (
    <InterimSection type={SectionKey.TRACE} title={t('Trace Preview')}>
      <SpanEvidenceKeyValueList event={rootEvent} projectSlug={projectSlug} />
      {hasProfilingFeature ? (
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
                    waterfallModel={new WaterfallModel(rootEvent)}
                    isEmbedded
                  />
                </TraceViewWrapper>
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      ) : (
        <TraceViewWrapper>
          <TraceView
            organization={organization}
            waterfallModel={new WaterfallModel(rootEvent)}
            isEmbedded
          />
        </TraceViewWrapper>
      )}
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

  // Only display this for error or default events since performance events are handled elsewhere
  if (
    group.issueCategory === IssueCategory.PERFORMANCE ||
    !organization.features.includes('issue-details-always-show-trace')
  ) {
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
