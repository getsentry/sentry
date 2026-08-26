import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import Ansi from 'ansi-to-react';

import {decodeTextAttachment} from 'sentry/components/events/attachmentViewers/decodeTextAttachment';
import {PreviewPanelItem} from 'sentry/components/events/attachmentViewers/previewPanelItem';
import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {resolveHostname} from 'sentry/utils/api/resolveHostname';

export function LogFileViewer(props: ViewerProps) {
  const attachmentUrl = resolveHostname(`/api/0${getAttachmentUrl(props)}?download`);
  const {data, isPending, isError} = useQuery({
    queryKey: ['attachment-text-preview', attachmentUrl],
    queryFn: async ({signal}) => {
      const response = await fetch(attachmentUrl, {
        credentials: 'include',
        headers: {Accept: '*/*'},
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to download attachment: ${response.status}`);
      }

      return decodeTextAttachment(await response.arrayBuffer());
    },
    staleTime: Infinity,
  });

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
