import React from 'react';
import styled from '@emotion/styled';

import {Event, EventAttachment} from 'app/types';
import space from 'app/styles/space';
import {PanelItem} from 'app/components/panels';
import AsyncComponent from 'app/components/asyncComponent';

type Props = {
  event: Event;
  orgId: string;
  projectId: string;
  attachment: EventAttachment;
} & AsyncComponent['props'];

type State = AsyncComponent['state'];

export default class LogFileViewer extends AsyncComponent<Props, State> {
  getEndpoints(): [string, string][] {
    const {orgId, projectId, event, attachment} = this.props;
    return [
      [
        'attachmentText',
        `/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download`,
      ],
    ];
  }

  renderBody() {
    const {attachmentText} = this.state;
    if (!attachmentText) {
      return null;
    }

    return (
      <LogPanelItem>
        <CodeWrapper>{attachmentText}</CodeWrapper>
      </LogPanelItem>
    );
  }
}

const LogPanelItem = styled(PanelItem)`
  overflow: auto;
  max-height: 300px;
  padding: 0;
`;

const CodeWrapper = styled('pre')`
  padding: ${space(1)} ${space(2)};
  width: 100%;
  &:after {
    content: '';
  }
`;
