import styled from '@emotion/styled';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import LazyLoad from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueAttachment, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  event: Event;
  orgId: Organization['id'];
  projectSlug: Project['slug'];
} & DeprecatedAsyncComponent['props'];

type State = {
  attachmentList: Array<IssueAttachment> | null;
} & DeprecatedAsyncComponent['state'];

class EventRRWebIntegrationContent extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {orgId, projectSlug, event} = this.props;
    return [
      [
        'attachmentList',
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
    ];
  }

  renderLoading() {
    // hide loading indicator
    return null;
  }

  renderBody() {
    const {attachmentList} = this.state;

    if (!attachmentList?.length) {
      return null;
    }

    const {orgId, projectSlug, event} = this.props;

    function createAttachmentUrl(attachment: IssueAttachment) {
      return `/api/0/projects/${orgId}/${projectSlug}/events/${event.id}/attachments/${attachment.id}/?download`;
    }

    return (
      <StyledReplayEventDataSection type="context-replay" title={t('Replay')}>
        <LazyLoad
          component={() => import('./rrwebReplayer')}
          urls={attachmentList.map(createAttachmentUrl)}
        />
      </StyledReplayEventDataSection>
    );
  }
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
