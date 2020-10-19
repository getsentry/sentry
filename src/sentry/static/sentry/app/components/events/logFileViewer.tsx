import React from 'react';
import styled from '@emotion/styled';
import ansicolor from 'ansicolor';

import {Event, EventAttachment} from 'app/types';
import space from 'app/styles/space';
import {PanelItem} from 'app/components/panels';
import AsyncComponent from 'app/components/asyncComponent';
import theme from 'app/utils/theme';

type Props = {
  event: Event;
  orgId: string;
  projectId: string;
  attachment: EventAttachment;
} & AsyncComponent['props'];

type State = AsyncComponent['state'];

const COLORS = {
  black: theme.black,
  white: theme.white,
  redDim: theme.red300,
  red: theme.red400,
  greenDim: theme.green300,
  green: theme.green400,
  yellowDim: theme.yellow300,
  yellow: theme.yellow400,
  blueDim: theme.blue400,
  blue: theme.blue500,
  magentaDim: theme.pink300,
  magenta: theme.pink400,
  cyanDim: theme.blue200,
  cyan: theme.blue300,
};

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

    const spans = ansicolor
      .parse(attachmentText)
      .spans.map(({color, bgColor, text}, idx) => {
        const style = {} as any;
        if (color) {
          if (color.name) {
            style.color =
              COLORS[color.name + (color.dim ? 'Dim' : '')] || COLORS[color.name] || '';
          }
          if (color.bright) {
            style.fontWeight = 500;
          }
        }
        if (bgColor && bgColor.name) {
          style.background =
            COLORS[bgColor.name + (bgColor.dim ? 'Dim' : '')] ||
            COLORS[bgColor.name] ||
            '';
        }
        return (
          <span style={style} key={idx}>
            {text}
          </span>
        );
      });

    return (
      <LogPanelItem>
        <CodeWrapper>{spans}</CodeWrapper>
      </LogPanelItem>
    );
  }
}

const LogPanelItem = styled(PanelItem)`
  overflow: auto;
  max-height: 500px;
  padding: 0;
`;

const CodeWrapper = styled('pre')`
  padding: ${space(1)} ${space(2)};
  width: 100%;
  &:after {
    content: '';
  }
`;
