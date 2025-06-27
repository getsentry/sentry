import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {ChapterList} from 'sentry/views/replays/detail/ai/chapterList';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';

import {useFetchReplaySummary} from './useFetchReplaySummary';

export default function Ai() {
  return (
    <PaddedFluidHeight>
      <SummaryTabItemContainer data-test-id="replay-details-ai-summary-tab">
        <ErrorBoundary mini>
          <AiContent />
        </ErrorBoundary>
      </SummaryTabItemContainer>
    </PaddedFluidHeight>
  );
}

function AiContent() {
  const organization = useOrganization();
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  const {
    data: summaryData,
    isPending,
    isError,
    isRefetching,
    refetch,
  } = useFetchReplaySummary({
    staleTime: Infinity,
    enabled: Boolean(
      replayRecord?.id &&
        project?.slug &&
        organization.features.includes('replay-ai-summaries')
    ),
    retry: false,
  });

  if (!organization.features.includes('replay-ai-summaries')) {
    return (
      <SummaryContainer>
        <Alert type="info">
          {t('Replay AI summary is not available for this organization.')}
        </Alert>
      </SummaryContainer>
    );
  }

  if (replayRecord?.project_id && !project) {
    return (
      <SummaryContainer>
        <Alert type="error">{t('Project not found. Unable to load AI summary.')}</Alert>
      </SummaryContainer>
    );
  }

  if (isPending || isRefetching) {
    return (
      <LoadingContainer>
        <LoadingIndicator />
      </LoadingContainer>
    );
  }

  if (isError) {
    return (
      <SummaryContainer>
        <Alert type="error">{t('Failed to load AI summary')}</Alert>
      </SummaryContainer>
    );
  }

  if (!summaryData) {
    return (
      <SummaryContainer>
        <Alert type="info">{t('No summary available for this replay.')}</Alert>
      </SummaryContainer>
    );
  }

  return (
    <ErrorBoundary mini>
      <SplitContainer>
        <Summary>
          <SummaryHeader>
            <SummaryHeaderTitle>
              <span>{t('Replay Summary')}</span>
              <Badge type="internal">{t('Internal')}</Badge>
            </SummaryHeaderTitle>
            <Button
              priority="default"
              type="button"
              size="xs"
              onClick={() => refetch()}
              icon={<IconRefresh size="xs" />}
            >
              {t('Regenerate')}
            </Button>
          </SummaryHeader>
          <SummaryText>{summaryData.data.summary}</SummaryText>
        </Summary>
        <ChapterList summaryData={summaryData} />
      </SplitContainer>
    </ErrorBoundary>
  );
}

const SummaryTabItemContainer = styled(TabItemContainer)`
  .beforeHoverTime:last-child {
    border-bottom-color: transparent;
  }
  .beforeCurrentTime:last-child {
    border-bottom-color: transparent;
  }
  details.beforeHoverTime + details.afterHoverTime,
  details.beforeCurrentTime + details.afterCurrentTime {
    border-top-color: transparent;
  }
`;

const SplitContainer = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: auto;
`;

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
  overflow: auto;
`;
const Summary = styled('div')`
  padding: ${space(0.5)} ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SummaryHeader = styled('h3')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  justify-content: space-between;
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSize.lg};
`;

const SummaryHeaderTitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SummaryText = styled('p')`
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
`;
