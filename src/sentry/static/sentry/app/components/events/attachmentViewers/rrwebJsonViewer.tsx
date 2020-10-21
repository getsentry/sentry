import React from 'react';

import {ViewerProps} from 'app/components/events/attachmentViewers/utils';
import PanelAlert from 'app/components/panels/panelAlert';
import {tct} from 'app/locale';
import JsonViewer from 'app/components/events/attachmentViewers/jsonViewer';

type State = {
  showRawJson: boolean;
};

export default class RRWebJsonViewer extends React.Component<ViewerProps, State> {
  constructor(props: ViewerProps, context: any) {
    super(props, context);
    this.state = {showRawJson: false};
  }

  render() {
    return (
      <React.Fragment>
        <PanelAlert type="info">
          {tct(
            'This is an attachment containing a session replay. [replayLink:View the replay] or [jsonLink:view the raw JSON].',
            {
              replayLink: <a href="#rrweb-replay" />,
              jsonLink: (
                <a
                  onClick={() =>
                    this.setState(({showRawJson}) => ({
                      showRawJson: !showRawJson,
                    }))
                  }
                />
              ),
            }
          )}
        </PanelAlert>
        {this.state.showRawJson && <JsonViewer {...this.props} />}
      </React.Fragment>
    );
  }
}
