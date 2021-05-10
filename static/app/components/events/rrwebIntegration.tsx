import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import EventDataSection from 'app/components/events/eventDataSection';
import LazyLoad from 'app/components/lazyLoad';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {EventAttachment, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';

type Props = {
  event: Event;
  orgId: Organization['id'];
  projectId: Project['id'];
} & AsyncComponent['props'];

type State = {
  attachmentList: Array<EventAttachment> | null;
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
