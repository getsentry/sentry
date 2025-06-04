import styled from '@emotion/styled';
import Ansi from 'ansi-to-react';

import PreviewPanelItem from 'sentry/components/events/attachmentViewers/previewPanelItem';
import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';

function LogFileViewer(props: ViewerProps) {
  const {data, isPending, isError} = useApiQuery<string>(
    [getAttachmentUrl(props), {headers: {Accept: '*/*; charset=utf-8'}}],
    {
      staleTime: Infinity,
    }
  );

  if (isError) {
    return <LoadingError message={t('Failed to download attachment.')} />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return data ? (
    <PreviewPanelItem>
      <CodeWrapper>
        <SentryStyleAnsi useClasses>{data}</SentryStyleAnsi>
      </CodeWrapper>
    </PreviewPanelItem>
  ) : null;
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
} as const;

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
