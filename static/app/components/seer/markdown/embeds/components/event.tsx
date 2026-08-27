import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {EventMessage} from 'sentry/components/events/eventMessage';
import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, EventIdResponse, Level} from 'sentry/types/event';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {EvidenceBoundary, EvidenceFrame, LazyEvidence} from './evidenceFrame';

type EventLookup = Event | EventIdResponse;

function EventEvidenceContent({eventId, issueId}: {eventId?: string; issueId?: string}) {
  const organization = useOrganization();
  const resolvesLatest = !eventId && Boolean(issueId);
  const url = resolvesLatest
    ? getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/', {
        path: {
          organizationIdOrSlug: organization.slug,
          issueId: issueId!,
          eventId: 'latest',
        },
      })
    : getApiUrl('/organizations/$organizationIdOrSlug/eventids/$eventId/', {
        path: {organizationIdOrSlug: organization.slug, eventId: eventId!},
      });
  const query = useApiQuery<EventLookup>([url], {retry: false, staleTime: Infinity});
  const event = query.data
    ? resolvesLatest
      ? (query.data as Event)
      : (query.data as EventIdResponse).event
    : undefined;
  const resolvedGroupId = resolvesLatest
    ? issueId
    : (query.data as EventIdResponse | undefined)?.groupId;
  const resolvedEventId = event?.eventID ?? event?.id ?? eventId;
  const href =
    resolvedGroupId && resolvedEventId
      ? `/organizations/${organization.slug}/issues/${resolvedGroupId}/events/${resolvedEventId}/`
      : undefined;
  const stacktrace = useMemo(() => (event ? getStacktrace(event) : null), [event]);
  const level =
    event && 'level' in event && typeof event.level === 'string'
      ? (event.level as Level)
      : undefined;

  return (
    <EvidenceFrame
      title={event ? t('Event %s', resolvedEventId ?? '') : t('Event evidence')}
      detail={resolvesLatest ? t('Latest event for this issue') : undefined}
      icon={IconIssues}
      href={href}
      isLoading={query.isPending}
      error={query.error}
      onRetry={() => query.refetch()}
    >
      {event ? (
        <Stack gap="md">
          <EventMessage
            level={level}
            message={event.title || event.message}
            type={event.type}
          />
          {stacktrace ? (
            <StacktraceClip>
              <StackTracePreviewContent event={event} stacktrace={stacktrace} />
            </StacktraceClip>
          ) : (
            <Text variant="muted">
              {t('No stack trace is available for this event.')}
            </Text>
          )}
        </Stack>
      ) : null}
    </EvidenceFrame>
  );
}

export const EventEvidence = defineSeerEmbed({
  name: 'event',
  render({event_id: eventId, issue_id: issueId}) {
    return (
      <EvidenceBoundary>
        <LazyEvidence>
          <EventEvidenceContent eventId={eventId} issueId={issueId} />
        </LazyEvidence>
      </EvidenceBoundary>
    );
  },
});

const StacktraceClip = styled('div')`
  max-height: 240px;
  overflow: auto;
  border-radius: ${p => p.theme.radius.sm};
`;
