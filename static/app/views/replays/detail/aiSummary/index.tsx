import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  replayRecord: ReplayRecord | undefined;
}

interface SummaryResponse {
  summary: string;
}

function createAISummaryQueryKey(orgSlug: string, replayId: string): ApiQueryKey {
  return [
    `/organizations/${orgSlug}/replays/summary/`,
    {
      method: 'POST',
      data: {
        replayId,
      },
    },
  ];
}

export default function AISummary({replayRecord}: Props) {
  const organization = useOrganization();

  const {
    data: summaryData,
    isLoading,
    isError,
    error,
  } = useApiQuery<SummaryResponse>(
    createAISummaryQueryKey(organization.slug, replayRecord?.id ?? ''),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: Boolean(replayRecord?.id),
    }
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <LoadingContainer>
          <LoadingIndicator />
        </LoadingContainer>
      );
    }

    if (isError || error) {
      return <Alert type="error">{t('Failed to load AI summary')}</Alert>;
    }

    if (!summaryData) {
      return <Alert type="info">{t('No summary available for this replay.')}</Alert>;
    }

    return (
      <SummaryContainer>
        <SummaryText>{summaryData.summary}</SummaryText>
      </SummaryContainer>
    );
  };

  return (
    <PaddedFluidHeight>
      <TabItemContainer data-test-id="replay-details-ai-summary-tab">
        {renderContent()}
      </TabItemContainer>
    </PaddedFluidHeight>
  );
}

const PaddedFluidHeight = styled(FluidHeight)`
  padding-top: ${space(1)};
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(4)};
`;

const SummaryContainer = styled('div')`
  padding: ${space(2)};
`;

const SummaryText = styled('p')`
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
`;
