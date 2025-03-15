import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button';
import {EventTraceViewInner} from 'sentry/components/events/interfaces/performance/eventTraceView';
import {getProblemSpansForSpanTree} from 'sentry/components/events/interfaces/performance/utils';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {
  getIssueTypeFromOccurrenceType,
  isOccurrenceBased,
  isTransactionBased,
} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';
import {useLocation} from 'sentry/utils/useLocation';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import TraceView from '../spans/traceView';
import type {TraceContextType} from '../spans/types';
import WaterfallModel from '../spans/waterfallModel';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

interface Props {
  event: EventTransaction;
  organization: Organization;
  projectSlug: string;
}

export type TraceContextSpanProxy = Omit<TraceContextType, 'span_id'> & {
  span_id: string; // TODO: Remove this temporary type.
};

function NewTraceViewContent({
  event,
  organization,
  traceId,
}: {
  event: EventTransaction;
  organization: Organization;
  traceId: string;
}) {
  const location = useLocation();

  const traceTarget = generateTraceTarget(
    event,
    organization,
    {
      ...location,
      query: {
        ...location.query,
        groupId: event.groupID,
      },
    },
    TraceViewSources.ISSUE_DETAILS
  );

  // TODO: use affectedSpanIds to display more of the trace
  // For example, the transaction has additional spans that should be highlighted are currently collapsed
  return (
    <EventTraceViewInner
      event={event}
      organization={organization}
      traceId={traceId}
      traceTarget={traceTarget}
    />
  );
}

export function SpanEvidenceSection({event, organization, projectSlug}: Props) {
  if (!event) {
    return null;
  }

  const {affectedSpanIds, focusedSpanIds} = getProblemSpansForSpanTree(event);

  const profileId = event.contexts?.profile?.profile_id ?? null;

  const hasProfilingFeature = organization.features.includes('profiling');

  const typeId = event.occurrence?.type;
  const issueType = getIssueTypeFromOccurrenceType(typeId);
  const issueTitle = event.occurrence?.issueTitle;
  const sanitizedIssueTitle = issueTitle && sanitizeQuerySelector(issueTitle);
  const hasSetting = isTransactionBased(typeId) && isOccurrenceBased(typeId);
  const hasNewTraceView = organization.features.includes(
    'issues-performance-new-trace-view'
  );
  const traceId = event.contexts.trace?.trace_id;

  return (
    <InterimSection
      type={SectionKey.SPAN_EVIDENCE}
      title={t('Span Evidence')}
      help={t(
        'Span Evidence identifies the root cause of this issue, found in other similar events within the same issue.'
      )}
      actions={
        issueType &&
        hasSetting && (
          <LinkButton
            data-test-id="span-evidence-settings-btn"
            to={{
              pathname: `/settings/${organization.slug}/projects/${projectSlug}/performance/`,
              query: {issueType},
              hash: sanitizedIssueTitle,
            }}
            size="xs"
            icon={<IconSettings />}
          >
            {t('Threshold Settings')}
          </LinkButton>
        )
      }
    >
      <SpanEvidenceKeyValueList event={event} projectSlug={projectSlug} />
      {hasProfilingFeature ? (
        hasNewTraceView && traceId ? (
          <NewTraceViewContent
            event={event}
            organization={organization}
            traceId={traceId}
          />
        ) : (
          <ProfilesProvider
            orgSlug={organization.slug}
            projectSlug={projectSlug}
            profileMeta={profileId || ''}
          >
            <ProfileContext.Consumer>
              {profiles => {
                return (
                  <ProfileGroupProvider
                    type="flamechart"
                    input={profiles?.type === 'resolved' ? profiles.data : null}
                    traceID={profileId || ''}
                  >
                    <TraceViewWrapper>
                      <TraceView
                        organization={organization}
                        waterfallModel={
                          new WaterfallModel(event, affectedSpanIds, focusedSpanIds)
                        }
                        isEmbedded
                      />
                    </TraceViewWrapper>
                  </ProfileGroupProvider>
                );
              }}
            </ProfileContext.Consumer>
          </ProfilesProvider>
        )
      ) : (
        <TraceViewWrapper>
          <TraceView
            organization={organization}
            waterfallModel={new WaterfallModel(event, affectedSpanIds, focusedSpanIds)}
            isEmbedded
          />
        </TraceViewWrapper>
      )}
    </InterimSection>
  );
}

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
