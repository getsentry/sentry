import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import JsonViewer from 'sentry/components/events/attachmentViewers/jsonViewer';
import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import PanelAlert from 'sentry/components/panels/panelAlert';
import {tct} from 'sentry/locale';

type State = {
  showRawJson: boolean;
};

export default class RRWebJsonViewer extends Component<ViewerProps, State> {
  state: State = {
    showRawJson: false,
  };

  render() {
    const {showRawJson} = this.state;

    return (
      <Fragment>
        <StyledPanelAlert margin={false} border={showRawJson} type="info">
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
      </Fragment>
    );
  }
}

const StyledPanelAlert = styled(PanelAlert)<{border: boolean}>`
  margin: 0;
  border-bottom: ${p => (p.border ? `1px solid ${p.theme.border}` : null)};
`;
