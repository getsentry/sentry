import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {JsonEventData} from 'sentry/components/structuredEventData/jsonEventData';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {PreviewPanelItem} from './previewPanelItem';
import type {ViewerProps} from './utils';

export function JsonViewer(props: ViewerProps) {
  const query = useQuery({
    ...apiOptions.as<Record<PropertyKey, unknown> | string>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/$attachmentId/',
      {
        path: {
          organizationIdOrSlug: props.orgSlug,
          projectIdOrSlug: props.projectSlug,
          eventId: props.eventId,
          attachmentId: props.attachment.id,
        },
        headers: {Accept: '*/*; charset=utf-8'},
        query: {download: true},
        staleTime: Infinity,
      }
    ),
    retry: false,
  });

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
    json = typeof query.data === 'object' ? query.data : JSON.parse(query.data);
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
