import styled from '@emotion/styled';
import Ansi from 'ansi-to-react';

import AsyncComponent from 'sentry/components/asyncComponent';
import PreviewPanelItem from 'sentry/components/events/attachmentViewers/previewPanelItem';
import {
  getAttachmentUrl,
  ViewerProps,
} from 'sentry/components/events/attachmentViewers/utils';
import {space} from 'sentry/styles/space';

type Props = ViewerProps & AsyncComponent['props'];

type State = AsyncComponent['state'];

class LogFileViewer extends AsyncComponent<Props, State> {
  getEndpoints(): [string, string][] {
    return [['attachmentText', getAttachmentUrl(this.props)]];
  }

  renderBody() {
    const {attachmentText} = this.state;

    return !attachmentText ? null : (
      <PreviewPanelItem>
        <CodeWrapper>
          <SentryStyleAnsi useClasses>{attachmentText}</SentryStyleAnsi>
        </CodeWrapper>
      </PreviewPanelItem>
    );
  }
}

export default LogFileViewer;

/**
 * Maps ANSI color names -> theme.tsx color names
 */
const COLOR_MAP = {
  red: 'red',
  green: 'green',
  blue: 'blue',
  yellow: 'yellow',
  magenta: 'pink',
  cyan: 'purple',
};

const SentryStyleAnsi = styled(Ansi)`
  ${p =>
    Object.entries(COLOR_MAP).map(
      ([ansiColor, themeColor]) => `
      .ansi-${ansiColor}-bg {
        background-color: ${p.theme[`${themeColor}400`]};
      }
      .ansi-${ansiColor}-fg {
        color: ${p.theme[`${themeColor}400`]};
      }
      .ansi-bright-${ansiColor}-fg {
        color: ${p.theme[`${themeColor}200`]};
      }`
    )}

  .ansi-black-fg,
  .ansi-bright-black-fg {
    color: ${p => p.theme.black};
  }
  .ansi-white-fg,
  .ansi-bright-white-fg {
    color: ${p => p.theme.white};
  }
`;

const CodeWrapper = styled('pre')`
  padding: ${space(1)} ${space(2)};
  width: 100%;
  margin-bottom: 0;
  &:after {
    content: '';
  }
`;
