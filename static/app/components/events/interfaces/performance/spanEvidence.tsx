import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {getProblemSpansForSpanTree} from 'sentry/components/events/interfaces/performance/utils';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  EventTransaction,
  getIssueTypeFromOccurrenceType,
  isOccurrenceBased,
  isTransactionBased,
  Organization,
} from 'sentry/types';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

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

  const typeId = event.occurrence?.type;
  const issueType = getIssueTypeFromOccurrenceType(typeId);
  const issueTitle = event.occurrence?.issueTitle;
  const sanitizedIssueTitle = issueTitle && sanitizeQuerySelector(issueTitle);
  const hasSetting = isTransactionBased(typeId) && isOccurrenceBased(typeId);

  return (
    <EventDataSection
      title={t('Span Evidence')}
      type="span-evidence"
      help={t(
        'Span Evidence identifies the root cause of this issue, found in other similar events within the same issue.'
      )}
      actions={
        issueType &&
        hasSetting && (
          <LinkButton
            data-test-id="span-evidence-settings-btn"
            to={`/settings/projects/${projectSlug}/performance/?issueType=${issueType}#${sanitizedIssueTitle}`}
            size="xs"
          >
            <StyledSettingsIcon size="xs" />
            Threshold Settings
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
