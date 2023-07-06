import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {getProblemSpansForSpanTree} from 'sentry/components/events/interfaces/performance/utils';
import {ProfilesProvider} from 'sentry/domains/profiling/profiling/profilesProvider';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  EventTransaction,
  getIssueTypeFromOccurenceType,
  IssueType,
  Organization,
} from 'sentry/types';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {projectDetectorSettingsId} from 'sentry/views/settings/projectPerformance/projectPerformance';

import TraceView from '../spans/traceView';
import {TraceContextType} from '../spans/types';
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

export function SpanEvidenceSection({event, organization, projectSlug}: Props) {
  if (!event) {
    return null;
  }

  const {affectedSpanIds, focusedSpanIds} = getProblemSpansForSpanTree(event);

  const profileId = event.contexts?.profile?.profile_id ?? null;

  const hasProfilingFeature = organization.features.includes('profiling');

  const issueType = getIssueTypeFromOccurenceType(event.occurrence?.type);
  const hasConfigurableThresholds =
    issueType &&
    ![
      IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS, // TODO Abdullah Khan: Remove check when thresholds for these two issues are configurable.
      IssueType.PERFORMANCE_CONSECUTIVE_HTTP,
    ].includes(issueType);

  return (
    <EventDataSection
      title={t('Span Evidence')}
      type="span-evidence"
      help={t(
        'Span Evidence identifies the root cause of this issue, found in other similar events within the same issue.'
      )}
      actions={
        hasConfigurableThresholds && (
          <LinkButton
            data-test-id="span-evidence-settings-btn"
            to={`/settings/projects/${projectSlug}/performance/#${projectDetectorSettingsId}`}
            size="xs"
          >
            <StyledSettingsIcon size="xs" />
            Settings
          </LinkButton>
        )
      }
    >
      <SpanEvidenceKeyValueList event={event} projectSlug={projectSlug} />
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
                    waterfallModel={
                      new WaterfallModel(
                        event as EventTransaction,
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
                event as EventTransaction,
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

const StyledSettingsIcon = styled(IconSettings)`
  margin-right: ${space(0.5)};
`;
