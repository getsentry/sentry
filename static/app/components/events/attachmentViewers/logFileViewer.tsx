import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Alert} from '@sentry/scraps/alert';
import Ansi from 'ansi-to-react';

import {PreviewPanelItem} from 'sentry/components/events/attachmentViewers/previewPanelItem';
import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';

const MAX_DISPLAY_BYTES = 512 * 1024; // 512 KB

export function LogFileViewer(props: ViewerProps) {
  const {data, isPending, isError} = useApiQuery<string>(
    [
      getAttachmentUrl(props),
      {headers: {Accept: '*/*; charset=utf-8'}, query: {download: true}},
    ],
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

  if (!data) {
    return null;
  }

  const isTruncated = data.length > MAX_DISPLAY_BYTES;
  const displayData = isTruncated ? data.slice(0, MAX_DISPLAY_BYTES) : data;

  return (
    <PreviewPanelItem>
      {isTruncated && (
        <Alert variant="warning">
          {t(
            'Showing first 512\u00a0KB of file. Download the full attachment to view the rest.'
          )}
        </Alert>
      )}
      <CodeWrapper>
        <SentryStyleAnsi useClasses>{displayData}</SentryStyleAnsi>
      </CodeWrapper>
    </PreviewPanelItem>
  );
}

/**
 * Maps ANSI color names -> theme.tsx color names
 */
const COLOR_MAP = {
  red: 'red',
  green: 'green',
  blue: 'blue',
  yellow: 'yellow',
  magenta: 'pink',
  cyan: 'blue',
} as const;

const SentryStyleAnsi = styled(Ansi)`
  ${p =>
    Object.entries(COLOR_MAP).map(
      ([ansiColor, themeColor]) => css`
        .ansi-${ansiColor}-bg {
          background-color: ${p.theme.colors[`${themeColor}500`]};
        }
        .ansi-${ansiColor}-fg {
          color: ${p.theme.colors[`${themeColor}500`]};
        }
        .ansi-bright-${ansiColor}-fg {
          color: ${p.theme.colors[`${themeColor}200`]};
        }
      `
    )}

  .ansi-black-fg,
  .ansi-bright-black-fg {
    color: ${p => p.theme.colors.black};
  }
  .ansi-white-fg,
  .ansi-bright-white-fg {
    color: ${p => p.theme.colors.white};
  }
`;

const CodeWrapper = styled('pre')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  width: 100%;
  margin-bottom: 0;
  &:after {
    content: '';
  }
`;
