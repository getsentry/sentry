import {skipToken} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {IssuePreviewSection} from './issuePreviewSection';

export interface IssueSummaryData {
  groupId: string;
  headline: string;
  eventId?: string | null;
  possibleCause?: string | null;
  trace?: string | null;
  whatsWrong?: string | null;
}

export function issueSummaryQueryOptions({
  enabled,
  groupId,
  organizationSlug,
}: {
  enabled: boolean;
  groupId: string;
  organizationSlug: string;
}) {
  return apiOptions.as<IssueSummaryData>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/summarize/',
    {
      path: enabled
        ? {organizationIdOrSlug: organizationSlug, issueId: groupId}
        : skipToken,
      method: 'POST',
      staleTime: Infinity,
    }
  );
}

export function IssuePreviewSummary({summary}: {summary: IssueSummaryData}) {
  const details = [
    {label: t('What happened'), value: summary.whatsWrong},
    {label: t('In the trace'), value: summary.trace},
    {label: t('Possible cause'), value: summary.possibleCause},
  ].filter((detail): detail is {label: string; value: string} => Boolean(detail.value));

  return (
    <IssuePreviewSection aria-label={t('Issue Summary')} defaultExpanded>
      <IssuePreviewSection.Title>{t('Issue Summary')}</IssuePreviewSection.Title>
      <IssuePreviewSection.Summary>
        <Markdown raw={summary.headline} />
      </IssuePreviewSection.Summary>
      {details.length > 0 && (
        <IssuePreviewSection.Content>
          <Stack gap="lg">
            {details.map(detail => (
              <Stack key={detail.label} gap="xs">
                <Text bold>{detail.label}</Text>
                <Markdown raw={detail.value} />
              </Stack>
            ))}
          </Stack>
        </IssuePreviewSection.Content>
      )}
    </IssuePreviewSection>
  );
}

export function IssuePreviewSummarySkeleton() {
  return (
    <IssuePreviewSection aria-label={t('Issue Summary')} defaultExpanded>
      <IssuePreviewSection.Title>{t('Issue Summary')}</IssuePreviewSection.Title>
      <IssuePreviewSection.Summary>
        <Stack gap="sm">
          <Placeholder height="16px" />
          <Placeholder height="16px" width="75%" />
        </Stack>
      </IssuePreviewSection.Summary>
      <IssuePreviewSection.Content>
        <Stack gap="lg">
          <Stack gap="xs">
            <Placeholder height="14px" width="120px" />
            <Placeholder height="40px" />
          </Stack>
          <Stack gap="xs">
            <Placeholder height="14px" width="96px" />
            <Placeholder height="40px" />
          </Stack>
        </Stack>
      </IssuePreviewSection.Content>
    </IssuePreviewSection>
  );
}
