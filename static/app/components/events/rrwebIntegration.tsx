import AsyncComponent from 'sentry/components/asyncComponent';
import LazyLoad from 'sentry/components/lazyLoad';
import {IssueAttachment, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';

type Props = {
  event: Event;
  orgId: Organization['id'];
  projectId: Project['id'];
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
        {query: {query: 'rrweb.json'}},
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

    const attachment = attachmentList[0];
    const {orgId, projectId, event} = this.props;

    return (
      <LazyLoad
        component={() => import('./rrwebReplayer')}
        url={`/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download`}
      />
    );
  }
}

export default RRWebIntegration;
