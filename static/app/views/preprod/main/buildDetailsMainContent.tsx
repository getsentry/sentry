import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Heading} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconGrid} from 'sentry/icons';
import {IconGraphCircle} from 'sentry/icons/iconGraphCircle';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {AppSizeTreemap} from 'sentry/views/preprod/main/appSizeTreemap';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';

interface BuildDetailsMainContentProps {
  appSizeQuery: UseApiQueryResult<AppSizeApiResponse, RequestError>;
}

export function BuildDetailsMainContent(props: BuildDetailsMainContentProps) {
  const {
    data: appSizeData,
    isPending: isAppSizePending,
    isError: isAppSizeError,
    error: appSizeError,
  } = props.appSizeQuery;

  const [selectedContent, setSelectedContent] = useState<'treemap' | 'categories'>(
    'treemap'
  );

  if (isAppSizePending) {
    return (
      <MainContentContainer>
        <LoadingIndicator />
      </MainContentContainer>
    );
  }

  if (isAppSizeError) {
    return (
      <MainContentContainer>
        <Alert type="error">{appSizeError?.message}</Alert>
      </MainContentContainer>
    );
  }

  if (!appSizeData) {
    return (
      <MainContentContainer>
        <Alert type="error">No app size data found</Alert>
      </MainContentContainer>
    );
  }

  const content =
    selectedContent === 'treemap' ? (
      <AppSizeTreemap treemapData={appSizeData.treemap} />
    ) : (
      <Heading as="h2">Categories (Coming soon)</Heading>
    );

  return (
    <MainContentContainer>
      <MainContentControls>
        <SegmentedControl
          value={selectedContent}
          onChange={value => setSelectedContent(value)}
        >
          <SegmentedControl.Item key="treemap" icon={<IconGrid />} />
          <SegmentedControl.Item key="categories" icon={<IconGraphCircle />} />
        </SegmentedControl>
      </MainContentControls>
      {content}
    </MainContentContainer>
  );
}

const MainContentContainer = styled('div')`
  width: 100%;
  height: 700px;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
`;

const MainContentControls = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};
`;
