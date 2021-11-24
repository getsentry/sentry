import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import EventDataSection from 'sentry/components/events/eventDataSection';
import LazyLoad from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
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
      <StyledEventDataSection type="context-replay" title={t('Replay')}>
        <LazyLoad
          component={() => import('./rrwebReplayer')}
          url={`/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download`}
        />
      </StyledEventDataSection>
    );
  }
}

const StyledEventDataSection = styled(EventDataSection)`
  overflow: hidden;
  margin-bottom: ${space(3)};
`;

export default RRWebIntegration;
