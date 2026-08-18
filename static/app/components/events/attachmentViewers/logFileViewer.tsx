import {css} from '@emotion/react';
import styled from '@emotion/styled';
import Ansi from 'ansi-to-react';

import {decodeAttachmentPreview} from 'sentry/components/events/attachmentViewers/decodeAttachmentText';
import {PreviewPanelItem} from 'sentry/components/events/attachmentViewers/previewPanelItem';
import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';

export function LogFileViewer(props: ViewerProps) {
  const {data, isPending, isError} = useApiQuery<ArrayBuffer | string>(
    [
      getAttachmentUrl(props),
      {
        headers: {Accept: '*/*'},
        query: {download: true},
        responseType: 'arraybuffer',
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  const previewText =
    data === undefined || data === null ? null : decodeAttachmentPreview(data);

  if (isError) {
    return <LoadingError message={t('Failed to download attachment.')} />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return previewText ? (
    <PreviewPanelItem>
      <CodeWrapper>
        <SentryStyleAnsi useClasses>{previewText}</SentryStyleAnsi>
      </CodeWrapper>
    </PreviewPanelItem>
  ) : null;
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
