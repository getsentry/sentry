import * as React from 'react';
import styled from '@emotion/styled';
import ansicolor from 'ansicolor';

import AsyncComponent from 'app/components/asyncComponent';
import PreviewPanelItem from 'app/components/events/attachmentViewers/previewPanelItem';
import {
  getAttachmentUrl,
  ViewerProps,
} from 'app/components/events/attachmentViewers/utils';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

type Props = ViewerProps & AsyncComponent['props'];

type State = AsyncComponent['state'];

const COLORS = {
  black: theme.black,
  white: theme.white,
  redDim: theme.red200,
  red: theme.red300,
  greenDim: theme.green200,
  green: theme.green300,
  yellowDim: theme.pink200,
  yellow: theme.pink300,
  blueDim: theme.blue200,
  blue: theme.blue300,
  magentaDim: theme.pink200,
  magenta: theme.pink300,
  cyanDim: theme.blue200,
  cyan: theme.blue300,
};

export default class LogFileViewer extends AsyncComponent<Props, State> {
  getEndpoints(): [string, string][] {
    return [['attachmentText', getAttachmentUrl(this.props)]];
  }

  renderBody() {
    const {attachmentText} = this.state;
    if (!attachmentText) {
      return null;
    }

    const spans = ansicolor
      .parse(attachmentText)
      .spans.map(({color, bgColor, text}, idx) => {
        const style = {} as React.CSSProperties;
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
      <PreviewPanelItem>
        <CodeWrapper>{spans}</CodeWrapper>
      </PreviewPanelItem>
    );
  }
}

const CodeWrapper = styled('pre')`
  padding: ${space(1)} ${space(2)};
  width: 100%;
  margin-bottom: 0;
  &:after {
    content: '';
  }
`;
