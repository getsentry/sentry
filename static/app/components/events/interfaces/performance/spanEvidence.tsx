import {LinkButton} from 'sentry/components/core/button/linkButton';
import {SpanEvidenceTraceView} from 'sentry/components/events/interfaces/performance/spanEvidenceTraceView';
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
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

interface Props {
  event: EventTransaction;
  organization: Organization;
  projectSlug: string;
}

function SpanEvidenceInterimSection({
  children,
  event,
  organization,
  projectSlug,
}: {children: React.ReactNode} & Props) {
  const typeId = event.occurrence?.type;
  const issueType = getIssueTypeFromOccurrenceType(typeId);
  const issueTitle = event.occurrence?.issueTitle;
  const sanitizedIssueTitle = issueTitle && sanitizeQuerySelector(issueTitle);
  const hasSetting = isTransactionBased(typeId) && isOccurrenceBased(typeId);

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
            title={t('Disable detector or adjust thresholds')}
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
    </InterimSection>
  );
}

export function SpanEvidenceSection({event, organization, projectSlug}: Props) {
  if (!event) {
    return null;
  }

  const traceId = event.contexts.trace?.trace_id;
  return (
    <SpanEvidenceInterimSection
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
    </SpanEvidenceInterimSection>
  );
}
