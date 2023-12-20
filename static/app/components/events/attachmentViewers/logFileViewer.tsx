import styled from '@emotion/styled';
import Ansi from 'ansi-to-react';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import PreviewPanelItem from 'sentry/components/events/attachmentViewers/previewPanelItem';
import {
  getAttachmentUrl,
  ViewerProps,
} from 'sentry/components/events/attachmentViewers/utils';
import {space} from 'sentry/styles/space';

type Props = ViewerProps & DeprecatedAsyncComponent['props'];

type State = DeprecatedAsyncComponent['state'];

class LogFileViewer extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [
      [
        'attachmentText',
        getAttachmentUrl(this.props),
        {headers: {Accept: '*/*; charset=utf-8'}},
      ],
    ];
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
