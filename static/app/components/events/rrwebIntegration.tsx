import AsyncComponent from 'sentry/components/asyncComponent';
import LazyLoad from 'sentry/components/lazyLoad';
import {IssueAttachment, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';

type Props = {
  event: Event;
  orgId: Organization['id'];
  projectId: Project['id'];
  renderer?: Function;
  replayVersion?: boolean;
} & AsyncComponent['props'];

type State = {
  attachmentList: Array<IssueAttachment> | null;
} & AsyncComponent['state'];

class RRWebIntegration extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, projectId, event} = this.props;
    return [
      [
        'attachmentList',
        `/projects/${orgId}/${projectId}/events/${event.id}/attachments/`,

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
    const renderer = this.props.renderer || (children => children);

    if (!attachmentList?.length) {
      return null;
    }

    const {orgId, projectId, event, replayVersion} = this.props;

    function createAttachmentUrl(attachment: IssueAttachment) {
      return `/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download`;
    }

    return renderer(
      <LazyLoad
        component={() => import('./rrwebReplayer')}
        event={event}
        urls={attachmentList.map(createAttachmentUrl)}
        replayVersion={replayVersion}
      />
    );
  }
}

export default RRWebIntegration;
