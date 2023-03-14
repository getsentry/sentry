import {useContext, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event, EventTransaction, Organization} from 'sentry/types';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import useApi from 'sentry/utils/useApi';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import TraceView from '../spans/traceView';
import {TraceContextType} from '../spans/types';
import WaterfallModel from '../spans/waterfallModel';

interface Props {
  event: Event;
  organization: Organization;
}

export type TraceContextSpanProxy = Omit<TraceContextType, 'span_id'> & {
  span_id: string; // TODO: Remove this temporary type.
};

export function AnrRootCause({organization}: Props) {
  const quickTrace = useContext(QuickTraceContext);
  const api = useApi();

  const [transactionEvent, setTransactionEvent] = useState<EventTransaction | undefined>(
    undefined
  );

  const performanceIssue = quickTrace?.trace?.[0]?.performance_issues?.[0];

  useEffect(() => {
    if (!performanceIssue) {
      return () => {};
    }
    const eventId = performanceIssue.event_id;
    const projectSlug = performanceIssue.project_slug;
    const groupId = performanceIssue.issue_id;
    let unmounted = false;
    const url = `/projects/${organization.slug}/${projectSlug}/events/${eventId}/?group_id=${groupId}`;
    api
      .requestPromise(url)
      .then(response => {
        if (unmounted) {
          return;
        }

        setTransactionEvent(response);
      })
      .catch(() => {});
    return () => {
      unmounted = true;
    };
  }, [organization.slug, performanceIssue, api]);

  if (!transactionEvent) {
    return null;
  }

  if (
    !quickTrace ||
    quickTrace.error ||
    quickTrace.trace === null ||
    quickTrace.trace.length === 0 ||
    quickTrace.trace[0]?.performance_issues?.length === 0
  ) {
    return null;
  }

  const offendingSpanIDs = transactionEvent.perfProblem?.offenderSpanIds ?? [];

  const affectedSpanIds = [...offendingSpanIDs];
  const focusedSpanIds: string[] = [];

  const profileId = transactionEvent.contexts?.profile?.profile_id ?? null;

  const hasProfilingPreviewsFeature =
    organization.features.includes('profiling') &&
    organization.features.includes('profiling-previews');

  return (
    <EventDataSection
      title={t('Contributing Issues')}
      type="contributing-issues"
      help={t('Contributing Issues identifies potential root cause of this event.')}
    >
      {hasProfilingPreviewsFeature ? (
        <ProfilesProvider
          orgSlug={organization.slug}
          projectSlug={performanceIssue!.project_slug}
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
                      new WaterfallModel(
                        transactionEvent as EventTransaction,
                        affectedSpanIds,
                        focusedSpanIds
                      )
                    }
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
            waterfallModel={
              new WaterfallModel(
                transactionEvent as EventTransaction,
                affectedSpanIds,
                focusedSpanIds
              )
            }
            isEmbedded
          />
        </TraceViewWrapper>
      )}
    </EventDataSection>
  );
}

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
