import {useMemo, useState} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Container, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FlamegraphAttachment} from 'sentry/components/events/flamegraphAttachment';
import {parseFlamegraphAttachment} from 'sentry/components/events/flamegraphAttachment/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {IssueAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

type Props = {event: Event; project: Project};

function EventFlamegraphContent({event, project}: Props) {
  const organization = useOrganization();
  const [selectedAttachment, setSelectedAttachment] = useState<string>();
  const attachmentsQuery = useQuery({
    ...apiOptions.as<IssueAttachment[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          eventId: event.id,
        },
        staleTime: Infinity,
      }
    ),
    retry: false,
  });
  const attachments =
    attachmentsQuery.data?.filter(attachment => attachment.type === 'event.flamegraph') ??
    [];
  const attachment =
    attachments.find(item => item.id === selectedAttachment) ?? attachments[0];
  const attachmentQuery = useQuery({
    ...apiOptions.as<unknown>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/$attachmentId/',
      {
        path: attachment
          ? {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
              eventId: attachment.event_id,
              attachmentId: attachment.id,
            }
          : skipToken,
        headers: {Accept: '*/*; charset=utf-8'},
        query: {download: true},
        staleTime: Infinity,
      }
    ),
    retry: false,
  });
  const parsed = useMemo(() => {
    if (attachmentQuery.isPending || attachmentQuery.isError) {
      return null;
    }
    try {
      return {data: parseFlamegraphAttachment(attachmentQuery.data)};
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : t('Failed to read flamegraph attachment.'),
      };
    }
  }, [attachmentQuery.data, attachmentQuery.isPending, attachmentQuery.isError]);

  if (attachmentsQuery.isError) {
    return (
      <FoldSection sectionKey={SectionKey.FLAMEGRAPH_ATTACHMENT} title={t('Flamegraph')}>
        <LoadingError
          message={getRequestErrorUserMessage(
            attachmentsQuery.error,
            t('Failed to load flamegraph attachments.')
          )}
          onRetry={attachmentsQuery.refetch}
        />
      </FoldSection>
    );
  }
  if (!attachment) {
    return null;
  }

  return (
    <FoldSection sectionKey={SectionKey.FLAMEGRAPH_ATTACHMENT} title={t('Flamegraph')}>
      <Stack gap="md">
        {attachments.length > 1 && (
          <Container maxWidth="400px">
            <Select
              aria-label={t('Flamegraph attachment')}
              value={attachment.id}
              options={attachments.map(item => ({value: item.id, label: item.name}))}
              onChange={option => setSelectedAttachment(option.value)}
              isClearable={false}
            />
          </Container>
        )}
        {attachmentQuery.isPending ? (
          <LoadingIndicator />
        ) : attachmentQuery.isError ? (
          <LoadingError
            message={getRequestErrorUserMessage(
              attachmentQuery.error,
              t('Failed to load flamegraph attachment.')
            )}
            onRetry={attachmentQuery.refetch}
          />
        ) : parsed && 'error' in parsed ? (
          <Alert variant="warning">{parsed.error}</Alert>
        ) : parsed && 'data' in parsed ? (
          <ErrorBoundary mini>
            <FlamegraphAttachment key={attachment.id} data={parsed.data} />
          </ErrorBoundary>
        ) : null}
      </Stack>
    </FoldSection>
  );
}

export function EventFlamegraph(props: Props) {
  const organization = useOrganization();
  if (
    !organization.features.includes('event-attachments') ||
    !organization.features.includes('flamegraph-attachments')
  ) {
    return null;
  }
  return <EventFlamegraphContent key={props.event.id} {...props} />;
}
