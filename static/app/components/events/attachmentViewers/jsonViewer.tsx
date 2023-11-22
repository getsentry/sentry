import styled from '@emotion/styled';

import ContextData from 'sentry/components/contextData';
import PreviewPanelItem from 'sentry/components/events/attachmentViewers/previewPanelItem';
import {
  getAttachmentUrl,
  ViewerProps,
} from 'sentry/components/events/attachmentViewers/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';

export default function JsonViewer(props: ViewerProps) {
  const query = useApiQuery(
    [getAttachmentUrl(props), {headers: {Accept: '*/*; charset=utf-8'}}],
    {
      staleTime: Infinity,
      retry: false,
    }
  );

  if (query.isLoading) {
    return (
      <LoadingContainer>
        <LoadingIndicator mini />
      </LoadingContainer>
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

  let json;
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
      <StyledContextData
        data={json}
        maxDefaultDepth={4}
        preserveQuotes
        style={{width: '100%'}}
        jsonConsts
      />
    </PreviewPanelItem>
  );
}

const LoadingContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)};
`;

const StyledContextData = styled(ContextData)`
  margin-bottom: 0;
`;
