import React from 'react';
import styled from '@emotion/styled';

import JsonViewer from 'app/components/events/attachmentViewers/jsonViewer';
import {ViewerProps} from 'app/components/events/attachmentViewers/utils';
import PanelAlert from 'app/components/panels/panelAlert';
import {tct} from 'app/locale';

type State = {
  showRawJson: boolean;
};

export default class RRWebJsonViewer extends React.Component<ViewerProps, State> {
  state: State = {
    showRawJson: false,
  };

  render() {
    const {showRawJson} = this.state;

    return (
      <React.Fragment>
        <StyledPanelAlert border={showRawJson} type="info">
          {tct(
            'This is an attachment containing a session replay. [replayLink:View the replay] or [jsonLink:view the raw JSON].',
            {
              replayLink: <a href="#context-replay" />,
              jsonLink: (
                <a
                  onClick={() =>
                    this.setState(state => ({
                      showRawJson: !state.showRawJson,
                    }))
                  }
                />
              ),
            }
          )}
        </StyledPanelAlert>
        {showRawJson && <JsonViewer {...this.props} />}
      </React.Fragment>
    );
  }
}

const StyledPanelAlert = styled(PanelAlert)<{border: boolean}>`
  margin: 0;
  border-bottom: ${p => (p.border ? `1px solid ${p.theme.border}` : null)};
`;
