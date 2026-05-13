import {LinkButton} from '@sentry/scraps/button';

import {SpanEvidenceTraceView} from 'sentry/components/events/interfaces/performance/spanEvidenceTraceView';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {
  AI_DETECTED_ISSUE_TYPES,
  getIssueTypeFromOccurrenceType,
  isOccurrenceBased,
  isTransactionBased,
} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

interface Props {
  event: EventTransaction;
  organization: Organization;
  projectSlug: string;
}

function SpanEvidenceFoldSection({
  children,
  event,
  organization,
  projectSlug,
}: {children: React.ReactNode} & Props) {
  const typeId = event.occurrence?.type;
  const issueType = getIssueTypeFromOccurrenceType(typeId);
  const issueTitle = event.occurrence?.issueTitle;
  const isAiDetected = issueType !== null && AI_DETECTED_ISSUE_TYPES.has(issueType);
  const hasSetting =
    (isTransactionBased(typeId) && isOccurrenceBased(typeId)) || isAiDetected;
  const hashTitle = isAiDetected ? 'AI Detected' : issueTitle;
  const sanitizedHash = hashTitle && sanitizeQuerySelector(hashTitle);

  return (
    <FoldSection
      sectionKey={SectionKey.SPAN_EVIDENCE}
      title={t('Span Evidence')}
      actions={
        issueType &&
        hasSetting && (
          <LinkButton
            data-test-id="span-evidence-settings-btn"
            to={{
              pathname: `/settings/${organization.slug}/projects/${projectSlug}/performance/`,
              query: {issueType},
              hash: sanitizedHash,
            }}
            size="xs"
            icon={<IconSettings />}
            tooltipProps={{title: t('Disable detector or adjust thresholds')}}
            analyticsEventName="Issue Details: Detector Settings Clicked"
            analyticsEventKey="issue_details.detector_settings_clicked"
            analyticsParams={{
              type: issueType,
            }}
          >
            {t('Detector Settings')}
          </LinkButton>
        )
      }
    >
      {children}
    </FoldSection>
  );
}

export function SpanEvidenceSection({event, organization, projectSlug}: Props) {
  if (!event) {
    return null;
  }

  const traceId = event.contexts.trace?.trace_id;
  return (
    <SpanEvidenceFoldSection
      event={event}
      organization={organization}
      projectSlug={projectSlug}
    >
      <SpanEvidenceKeyValueList event={event} projectSlug={projectSlug} />
      {traceId && (
        <SpanEvidenceTraceView
          event={event}
          organization={organization}
          traceId={traceId}
        />
      )}
    </SpanEvidenceFoldSection>
  );
}
