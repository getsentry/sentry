import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import BreadcrumbRow from 'sentry/views/replays/detail/breadcrumbs/breadcrumbRow';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  replayRecord: ReplayRecord | undefined;
}

interface SummaryResponse {
  data: {
    summary: string;
    time_ranges: Array<{period_end: number; period_start: number; period_title: string}>;
    title: string;
  };
}

function createAISummaryQueryKey(
  orgSlug: string,
  projectSlug: string | undefined,
  replayId: string
): ApiQueryKey {
  return [
    `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/summarize/breadcrumbs/`,
  ];
}

export default function Ai({replayRecord}: Props) {
  return (
    <PaddedFluidHeight>
      <TabItemContainer data-test-id="replay-details-ai-summary-tab">
        <ErrorBoundary mini>
          <AiContent replayRecord={replayRecord} />
        </ErrorBoundary>
      </TabItemContainer>
    </PaddedFluidHeight>
  );
}

function AiContent({replayRecord}: Props) {
  const {replay} = useReplayContext();
  const organization = useOrganization();
  const project = useProjectFromId({project_id: replayRecord?.project_id});

  const {
    data: summaryData,
    isPending,
    isError,
    isRefetching,
    refetch,
  } = useApiQuery<SummaryResponse>(
    createAISummaryQueryKey(organization.slug, project?.slug, replayRecord?.id ?? ''),
    {
      staleTime: 0,
      enabled: Boolean(
        replayRecord?.id &&
          project?.slug &&
          organization.features.includes('replay-ai-summaries')
      ),
      retry: false,
    }
  );

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

  const chapterData = summaryData?.data.time_ranges.map(
    ({period_title, period_start, period_end}) => ({
      title: period_title,
      start: period_start * 1000,
      end: period_end * 1000,
      breadcrumbs:
        replay
          ?.getChapterFrames()
          .filter(
            breadcrumb =>
              breadcrumb.timestampMs >= period_start * 1000 &&
              breadcrumb.timestampMs <= period_end * 1000
          ) ?? [],
    })
  );

  return (
    <ErrorBoundary mini>
      <SummaryContainer>
        <SummaryHeader>
          <SummaryHeaderTitle>
            <span>{t('Replay Summary')}</span>
            <Badge type="internal">{t('Internal')}</Badge>
          </SummaryHeaderTitle>
          <Button priority="primary" size="xs" onClick={() => refetch()}>
            {t('Regenerate')}
          </Button>
        </SummaryHeader>
        <SummaryText>{summaryData.data.summary}</SummaryText>
        <div>
          {chapterData.map(({title, start, breadcrumbs}, i) => (
            <Details key={i}>
              <Summary>
                <SummaryTitle>
                  <span>{title}</span>

                  <ReplayTimestamp>
                    <TimestampButton
                      startTimestampMs={replay?.getStartTimestampMs() ?? 0}
                      timestampMs={start}
                    />
                  </ReplayTimestamp>
                </SummaryTitle>
              </Summary>
              <div>
                {!breadcrumbs.length && (
                  <EmptyMessage>{t('No breadcrumbs for this chapter')}</EmptyMessage>
                )}
                {breadcrumbs.map((breadcrumb, j) => (
                  <BreadcrumbRow
                    frame={breadcrumb}
                    index={j}
                    onClick={() => {}}
                    onInspectorExpanded={() => {}}
                    onShowSnippet={() => {}}
                    showSnippet={false}
                    allowShowSnippet={false}
                    startTimestampMs={breadcrumb.timestampMs}
                    key={`breadcrumb-${j}`}
                    style={{}}
                  />
                ))}
              </div>
            </Details>
          ))}
        </div>
      </SummaryContainer>
    </ErrorBoundary>
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
  overflow: auto;
`;

const SummaryHeader = styled('h3')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  justify-content: space-between;
`;

const SummaryHeaderTitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const Details = styled('details')`
  &[open] > summary::before {
    content: '-';
  }
`;

const Summary = styled('summary')`
  cursor: pointer;
  display: list-item;
  padding: ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeLarge};

  /* sorry */
  &:focus-visible {
    outline: none;
  }

  list-style-type: none;
  &::-webkit-details-marker {
    display: none;
  }
  &::before {
    content: '+';
    float: left;
    display: inline-block;
    width: 14px;
    margin-right: ${space(1)};
    font-size: ${p => p.theme.fontSizeExtraLarge};
  }
`;

const SummaryTitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  justify-content: space-between;
`;

const SummaryText = styled('p')`
  line-height: 1.6;
  white-space: pre-wrap;
`;

// Copied from breadcrumbItem
const ReplayTimestamp = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
`;
