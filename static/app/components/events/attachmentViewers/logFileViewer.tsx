import {css} from '@emotion/react';
import styled from '@emotion/styled';
import Ansi from 'ansi-to-react';

import {Alert} from 'sentry/components/alert';
import {PreviewPanelItem} from 'sentry/components/events/attachmentViewers/previewPanelItem';
import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';

// Large log files can crash the browser via ansi-to-react's escape-carriage dependency.
// Truncate to a safe size before rendering.
const MAX_LOG_DISPLAY_SIZE = 500_000;

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

  const isTruncated = data.length > MAX_LOG_DISPLAY_SIZE;
  const displayData = isTruncated ? data.slice(0, MAX_LOG_DISPLAY_SIZE) : data;

  return (
    <PreviewPanelItem>
      {isTruncated && (
        <Alert type="warning" showIcon>
          {t(
            'This log file is too large to display in full. Showing the first %s characters. ',
            MAX_LOG_DISPLAY_SIZE.toLocaleString()
          )}
          <a href={`${getAttachmentUrl(props)}?download=true`}>{t('Download full file')}</a>
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
