import React from 'react';
import styled from '@emotion/styled';

import EventDataSection from 'app/components/events/eventDataSection';
import {Panel} from 'app/components/panels';
import AsyncComponent from 'app/components/asyncComponent';
import LazyLoad from 'app/components/lazyLoad';
import space from 'app/styles/space';
import {Event, Organization, Project, EventAttachment} from 'app/types';
import {t} from 'app/locale';

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
      <EventDataSection type="context-replay" title={t('Replay')}>
        <StyledPanel>
          <LazyLoad
            component={() =>
              import(/* webpackChunkName: "rrwebReplayer" */ './rrwebReplayer').then(
                mod => mod.default
              )
            }
            url={`/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download`}
          />
        </StyledPanel>
      </EventDataSection>
    );
  }
}

const StyledPanel = styled(Panel)`
  overflow: hidden;
  margin-bottom: ${space(3)};
`;

export default RRWebIntegration;
