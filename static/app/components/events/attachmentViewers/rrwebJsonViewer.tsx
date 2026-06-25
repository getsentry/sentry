import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {JsonViewer} from 'sentry/components/events/attachmentViewers/jsonViewer';
import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {tct} from 'sentry/locale';

export function RRWebJsonViewer(props: ViewerProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  return (
    <Fragment>
      <StyledPanelAlert border={showRawJson} variant="info">
        {tct(
          'This is an attachment containing a session replay. [replayLink:View the replay] or [jsonLink:view the raw JSON].',
          {
            replayLink: <a href="#context-replay" />,
            jsonLink: <a onClick={() => setShowRawJson(value => !value)} />,
          }
        )}
      </StyledPanelAlert>
      {showRawJson && <JsonViewer {...props} />}
    </Fragment>
  );
}

const StyledPanelAlert = styled(PanelAlert)<{border: boolean}>`
  margin: 0;
  border-bottom: ${p => (p.border ? `1px solid ${p.theme.tokens.border.primary}` : null)};
`;
