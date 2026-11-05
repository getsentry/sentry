import {lazy} from 'react';
import {useQuery} from '@tanstack/react-query';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingError} from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {IssueAttachment} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

type Props = {
  event: Event;
  orgId: Organization['id'];
  projectSlug: Project['slug'];
  disableCollapsePersistence?: boolean;
};

const LazyReplayer = lazy(() => import('./rrwebReplayer'));

function EventRRWebIntegrationContent({
  orgId,
  projectSlug,
  event,
  disableCollapsePersistence,
}: Props) {
  const {
    data: attachmentList,
    isPending,
    isError,
    refetch,
  } = useQuery(
    apiOptions.as<IssueAttachment[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/',
      {
        path: {
          organizationIdOrSlug: orgId,
          projectIdOrSlug: projectSlug,
          eventId: event.id,
        },
        // Match single replay files and incremental rrweb attachments.
        query: {query: 'rrweb'},
        staleTime: 0,
      }
    )
  );

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (isPending) {
    // hide loading indicator
    return null;
  }

  if (!attachmentList?.length) {
    return null;
  }

  const createAttachmentUrl = (attachment: IssueAttachment) =>
    `/api/0/projects/${orgId}/${projectSlug}/events/${event.id}/attachments/${attachment.id}/?download`;

  return (
    <FoldSection
      sectionKey={SectionKey.RRWEB}
      title={t('Replay')}
      disableCollapsePersistence={disableCollapsePersistence}
    >
      <LazyLoad
        LazyComponent={LazyReplayer}
        urls={attachmentList.map(createAttachmentUrl)}
      />
    </FoldSection>
  );
}

export function EventRRWebIntegration(props: Props) {
  const organization = useOrganization();
  const hasReplay = Boolean(
    props.event?.tags?.find(({key}) => key === 'replayId')?.value
  );
  const hasEventAttachmentsFeature = organization.features.includes('event-attachments');

  if (hasReplay || !hasEventAttachmentsFeature) {
    return null;
  }

  return <EventRRWebIntegrationContent {...props} />;
}
