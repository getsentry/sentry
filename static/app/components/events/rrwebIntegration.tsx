import {lazy} from 'react';
import styled from '@emotion/styled';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import LazyLoad from 'sentry/components/lazyLoad';
import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {IssueAttachment} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  event: Event;
  orgId: Organization['id'];
  projectSlug: Project['slug'];
};

const LazyReplayer = lazy(() => import('./rrwebReplayer'));

function EventRRWebIntegrationContent({orgId, projectSlug, event}: Props) {
  const {
    data: attachmentList,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<IssueAttachment[]>(
    [
      `/projects/${orgId}/${projectSlug}/events/${event.id}/attachments/`,
      // This was changed from `rrweb.json`, so that we can instead
      // support incremental rrweb events as attachments. This is to avoid
      // having clients uploading a single, large sized replay.
      //
      // Note: This will include all attachments that contain `rrweb`
      // anywhere its name. We need to maintain compatibility with existing
      // rrweb plugin users (single replay), but also support incremental
      // replays as well. I can't think of a reason why someone would have
      // a non-rrweb replay containing the string `rrweb`, but people have
      // surprised me before.
      {query: {query: 'rrweb'}},
    ],
    {staleTime: 0}
  );

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (isLoading) {
    // hide loading indicator
    return null;
  }

  if (!attachmentList?.length) {
    return null;
  }

  const createAttachmentUrl = (attachment: IssueAttachment) =>
    `/api/0/projects/${orgId}/${projectSlug}/events/${event.id}/attachments/${attachment.id}/?download`;

  return (
    <StyledReplayEventDataSection type="context-replay" title={t('Replay')}>
      <LazyLoad
        LazyComponent={LazyReplayer}
        urls={attachmentList.map(createAttachmentUrl)}
      />
    </StyledReplayEventDataSection>
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

const StyledReplayEventDataSection = styled(EventDataSection)`
  overflow: hidden;
  margin-bottom: ${space(3)};
`;
