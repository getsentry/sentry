import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {PanelItem} from 'app/components/panels';
import AsyncComponent from 'app/components/asyncComponent';

export default class LogFileViewer extends AsyncComponent {
  static propTypes = {
    ...AsyncComponent.propTypes,
    event: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    attachment: PropTypes.object.isRequired,
  };

  getEndpoints() {
    const {orgId, projectId, event, attachment} = this.props;
    return [
      [
        'attachmentText',
        `/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download`,
      ],
    ];
  }

  /*
  renderLoading() {
    // hide loading indicator
    return null;
  }
  */

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
