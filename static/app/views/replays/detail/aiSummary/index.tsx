import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
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

export default function AISummary({replayRecord}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!replayRecord) {
      return;
    }

    const fetchSummary = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const endpoint = `/organizations/${organization.slug}/replays/summary/`;
        const data: SummaryResponse = await api.requestPromise(endpoint, {
          method: 'POST',
          data: {
            replayId: replayRecord.id,
          },
        });
        setSummaryData(data);
      } catch (err) {
        setError(t('Failed to load AI summary'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [api, replayRecord, organization.slug]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <LoadingContainer>
          <LoadingIndicator />
        </LoadingContainer>
      );
    }

    if (error) {
      return (
        <Alert type="error">
          {error}
        </Alert>
      );
    }

    if (!summaryData) {
      return (
        <Alert type="info">
          {t('No summary available for this replay.')}
        </Alert>
      );
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
