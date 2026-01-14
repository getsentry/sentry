import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import PreviewPanelItem from 'sentry/components/events/attachmentViewers/previewPanelItem';
import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {JsonEventData} from 'sentry/components/structuredEventData/jsonEventData';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';

export default function JsonViewer(props: ViewerProps) {
  const query = useApiQuery(
    [getAttachmentUrl(props), {headers: {Accept: '*/*; charset=utf-8'}}],
    {
      staleTime: Infinity,
      retry: false,
    }
  );

  if (query.isPending) {
    return (
      <Flex align="center" padding="md">
        <LoadingIndicator mini />
      </Flex>
    );
  }

  if (query.isError) {
    return (
      <LoadingError message={t('Failed to load attachment.')} onRetry={query.refetch} />
    );
  }

  if (!query.data) {
    return null;
  }

  let json: any;
  try {
    /**
     * The api might return a string or an object depending on headers and filename.
     */
    json = typeof query.data === 'object' ? query.data : JSON.parse(query.data as string);
  } catch (e) {
    json = null;
  }

  return (
    <PreviewPanelItem>
      <StyledJsonData data={json} maxDefaultDepth={4} />
    </PreviewPanelItem>
  );
}

const StyledJsonData = styled(JsonEventData)`
  margin-bottom: 0;
  width: 100%;
`;
