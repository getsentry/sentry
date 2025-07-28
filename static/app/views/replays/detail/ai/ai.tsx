import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSeer, IconSync, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {isSpanFrame} from 'sentry/utils/replays/types';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {ChapterList} from 'sentry/views/replays/detail/ai/chapterList';
import {
  NO_REPLAY_SUMMARY_MESSAGES,
  ReplaySummaryStatus,
} from 'sentry/views/replays/detail/ai/utils';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';

import {useFetchReplaySummary} from './useFetchReplaySummary';

export default function Ai() {
  const organization = useOrganization();
  const {
    areAiFeaturesAllowed,
    setupAcknowledgement,
    isPending: isOrgSeerSetupPending,
  } = useOrganizationSeerSetup();

  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();
  const segmentCount = replayRecord?.count_segments ?? 0;
  const project = useProjectFromId({project_id: replayRecord?.project_id});

  const {
    summaryData,
    isPending: isSummaryPending,
    isPolling,
    isError,
    triggerSummary,
  } = useFetchReplaySummary({
    staleTime: 0,
    enabled: Boolean(
      replayRecord?.id &&
        project?.slug &&
        organization.features.includes('replay-ai-summaries') &&
        areAiFeaturesAllowed &&
        setupAcknowledgement.orgHasAcknowledged
    ),
  });

  const segmentsIncreased =
    summaryData?.num_segments && segmentCount > summaryData.num_segments;
  const summaryIsOld =
    summaryData?.created_at &&
    new Date(summaryData.created_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const needsInitialGeneration =
    summaryData?.status === ReplaySummaryStatus.NOT_STARTED || !summaryData?.data;

  useEffect(() => {
    if (
      (segmentsIncreased || summaryIsOld || needsInitialGeneration) &&
      !isSummaryPending &&
      !isPolling &&
      !isError
    ) {
      triggerSummary();
    }
  }, [
    segmentsIncreased,
    summaryIsOld,
    needsInitialGeneration,
    isSummaryPending,
    isPolling,
    triggerSummary,
    isError,
  ]);

  if (!organization.features.includes('replay-ai-summaries') || !areAiFeaturesAllowed) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EmptySummaryContainer>
          <Alert type="warning">
            {t('AI features are not available for this organization.')}
          </Alert>
        </EmptySummaryContainer>
      </Wrapper>
    );
  }

  // check for org seer setup first before attempting to fetch summary
  if (isOrgSeerSetupPending) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <LoadingContainer>
          <LoadingIndicator />
        </LoadingContainer>
      </Wrapper>
    );
  }

  // If our `replay-ai-summaries` ff is enabled and the org has gen AI ff enabled,
  // but the org hasn't acknowledged the gen AI features, then show CTA.
  if (!setupAcknowledgement.orgHasAcknowledged) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EmptySummaryContainer>
          <CallToActionContainer>
            <div>
              <strong>{t('AI-Powered Replay Summaries')}</strong>
            </div>
            <div>
              {t(
                'Seer access is required to use replay summaries. Please view the Seer settings page for more information.'
              )}
            </div>
            <div>
              <LinkButton size="sm" priority="primary" to="/settings/seer/">
                {t('View Seer Settings')}
              </LinkButton>
            </div>
          </CallToActionContainer>
        </EmptySummaryContainer>
      </Wrapper>
    );
  }

  if (isSummaryPending || isPolling) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <LoadingContainer>
          <LoadingIndicator />
        </LoadingContainer>
      </Wrapper>
    );
  }

  if (replayRecord?.project_id && !project) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EmptySummaryContainer>
          <Alert type="error">
            {t('Project not found. Unable to load replay summary.')}
          </Alert>
        </EmptySummaryContainer>
      </Wrapper>
    );
  }

  if (isError) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EmptySummaryContainer>
          <Alert type="error">{t('Failed to load replay summary.')}</Alert>
        </EmptySummaryContainer>
      </Wrapper>
    );
  }

  if (!summaryData?.data) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EmptySummaryContainer>
          <Alert type="info" showIcon={false}>
            {t('No summary available for this replay.')}
          </Alert>
        </EmptySummaryContainer>
      </Wrapper>
    );
  }

  if (summaryData.data.time_ranges.length <= 1) {
    if (
      replay
        ?.getChapterFrames()
        ?.filter(frame => isSpanFrame(frame) || frame.category !== 'replay.init')
        .length === 0
    ) {
      return (
        <Wrapper data-test-id="replay-details-ai-summary-tab">
          <EmptySummaryContainer>
            <Alert type="info" showIcon={false}>
              {
                NO_REPLAY_SUMMARY_MESSAGES[
                  Math.floor(Math.random() * NO_REPLAY_SUMMARY_MESSAGES.length)
                ]
              }
            </Alert>
          </EmptySummaryContainer>
        </Wrapper>
      );
    }
  }

  return (
    <Wrapper data-test-id="replay-details-ai-summary-tab">
      <Summary>
        <SummaryLeft>
          <SummaryLeftTitle>
            <Flex align="center" gap="xs">
              {t('Replay Summary')}
              <IconSeer />
            </Flex>
            <Badge type="internal">{t('Internal')}</Badge>
          </SummaryLeftTitle>
          <SummaryText>{summaryData.data.summary}</SummaryText>
        </SummaryLeft>
        <SummaryRight>
          <Flex gap="xs">
            <FeedbackButton type="positive" />
            <FeedbackButton type="negative" />
          </Flex>
          <Button
            priority="default"
            type="button"
            size="xs"
            onClick={() => {
              triggerSummary();
              trackAnalytics('replay.ai-summary.regenerate-requested', {
                organization,
              });
            }}
            icon={<IconSync size="xs" />}
          >
            {t('Regenerate')}
          </Button>
        </SummaryRight>
      </Summary>
      <StyledTabItemContainer>
        <OverflowBody>
          <ChapterList timeRanges={summaryData.data.time_ranges} />
        </OverflowBody>
      </StyledTabItemContainer>
    </Wrapper>
  );
}

function FeedbackButton({type}: {type: 'positive' | 'negative'}) {
  const openForm = useFeedbackForm();
  if (!openForm) {
    return null;
  }

  return (
    <Button
      aria-label={t('Give feedback on the replay summary section')}
      icon={<IconThumb direction={type === 'positive' ? 'up' : 'down'} />}
      title={type === 'positive' ? t('I like this') : t(`I don't like this`)}
      size={'xs'}
      onClick={() =>
        openForm({
          messagePlaceholder:
            type === 'positive'
              ? t('What did you like about the replay summary and chapters?')
              : t('How can we make the replay summary and chapters work better for you?'),
          tags: {
            ['feedback.source']: 'replay_ai_summary',
            ['feedback.owner']: 'replay',
            ['feedback.type']: type,
          },
        })
      }
    />
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  min-height: 0;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const EmptySummaryContainer = styled('div')`
  padding: ${space(2)};
  overflow: auto;
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(4)};
`;

const Summary = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  border-bottom: 1px solid ${p => p.theme.border};
  gap: ${space(4)};
  justify-content: space-between;
`;

const SummaryLeft = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  justify-content: space-between;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const SummaryRight = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: flex-end;
`;

const SummaryLeftTitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SummaryText = styled('p')`
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const StyledTabItemContainer = styled(TabItemContainer)`
  border: none;

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

const OverflowBody = styled('section')`
  flex: 1 1 auto;
  overflow: auto;
`;

const CallToActionContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(2)};
  align-items: center;
  text-align: center;
`;
