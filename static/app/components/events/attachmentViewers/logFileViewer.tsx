import styled from '@emotion/styled';

import {AnsiText} from 'sentry/components/ansiText';
import {PreviewPanelItem} from 'sentry/components/events/attachmentViewers/previewPanelItem';
import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';

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

  return data ? (
    <PreviewPanelItem>
      <CodeWrapper>
        <Code>
          <AnsiText text={data} normalizeTerminalSequences />
        </Code>
      </CodeWrapper>
    </PreviewPanelItem>
  ) : null;
}

const CodeWrapper = styled('pre')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  width: 100%;
  margin-bottom: 0;
  &:after {
    content: '';
  }
`;

const Code = styled('code')`
  display: block;
`;
