import React from 'react';

import AsyncComponent from 'sentry/components/asyncComponent';
import LazyLoad from 'sentry/components/lazyLoad';
import {IssueAttachment, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';

type Props = {
  event: Event;
  orgId: Organization['id'];
  projectId: Project['id'];
  renderer?: Function;
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

    const {orgId, projectId, event} = this.props;

    function createAttachmentUrl(attachment: IssueAttachment) {
      return `/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download`;
    }

    return renderer(
      <LazyLoad
        component={() => import('./rrwebReplayer')}
        urls={attachmentList.map(createAttachmentUrl)}
      />
    );
  }
}

export default RRWebIntegration;
