import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import aiBanner from 'sentry-images/spot/ai-suggestion-banner-stars.svg';
import replayEmptyState from 'sentry-images/spot/replays-empty-state.svg';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import Placeholder from 'sentry/components/placeholder';
import {IconSync, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {ChapterList} from 'sentry/views/replays/detail/ai/chapterList';
import {useReplaySummaryContext} from 'sentry/views/replays/detail/ai/replaySummaryContext';
import {ReplaySummaryLoading} from 'sentry/views/replays/detail/ai/replaySummaryLoading';
import {NO_REPLAY_SUMMARY_MESSAGES} from 'sentry/views/replays/detail/ai/utils';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';

const MAX_SEGMENTS_TO_SUMMARIZE = 150;

export default function Ai() {
  const organization = useOrganization();
  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();

  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();
  const segmentCount = replayRecord?.count_segments ?? 0;
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  const analyticsArea = useAnalyticsArea();

  const {
    summaryData,
    isPending: isSummaryPending,
    isError,
    isTimedOut,
    startSummaryRequest,
  } = useReplaySummaryContext();

  const onlyInitFrames = useMemo(
    () =>
      replay
        ?.getChapterFrames()
        ?.every(frame => 'category' in frame && frame.category === 'replay.init'),
    [replay]
  );

  if (replayRecord?.project_id && !project) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EndStateContainer>
          <img src={replayEmptyState} height={300} alt="" />
          <div>{t('Project not found. Unable to load replay summary.')}</div>
        </EndStateContainer>
      </Wrapper>
    );
  }

  if (!organization.features.includes('replay-ai-summaries') || !areAiFeaturesAllowed) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EndStateContainer>
          <img src={replayEmptyState} height={300} alt="" />
          <div>
            {areAiFeaturesAllowed
              ? t('Replay summaries are not available for this organization.')
              : t('AI features are not available for this organization.')}
          </div>
        </EndStateContainer>
      </Wrapper>
    );
  }

  const hasError = isError || isTimedOut;
  const hasSummaryData = Boolean(summaryData?.data);
  const isNoReplaySummary = Boolean(
    hasSummaryData && summaryData!.data!.time_ranges.length <= 1 && onlyInitFrames
  );
  const feedbackDisabled =
    isSummaryPending || hasError || !hasSummaryData || isNoReplaySummary;

  const errorMessage = isTimedOut
    ? t('Failed to load replay summary - timed out.')
    : t('Failed to load replay summary.');

  return (
    <Wrapper data-test-id="replay-details-ai-summary-tab">
      <Summary>
        <SummaryLeft>
          <Flex align="center" justify="between">
            {t('Replay Summary')}
            <Button
              priority="default"
              type="button"
              size="xs"
              disabled={isSummaryPending}
              onClick={() => {
                startSummaryRequest();
                trackAnalytics('replay.ai-summary.regenerate-requested', {
                  organization,
                  area: analyticsArea + '.finished-summary',
                });
              }}
              icon={<IconSync size="xs" />}
            >
              {hasError ? t('Retry') : t('Regenerate')}
            </Button>
          </Flex>
          <Flex align="center" justify="between" gap="xs">
            <SummaryTextArea
              isSummaryPending={isSummaryPending}
              hasError={hasError}
              errorMessage={errorMessage}
              summaryText={summaryData?.data?.summary}
              isNoReplaySummary={isNoReplaySummary}
            />
            <Flex gap="xs" flexShrink={0}>
              <ThumbsUpDownButton type="positive" disabled={feedbackDisabled} />
              <ThumbsUpDownButton type="negative" disabled={feedbackDisabled} />
            </Flex>
          </Flex>
        </SummaryLeft>
      </Summary>
      <SummaryContent
        isSummaryPending={isSummaryPending}
        hasError={hasError}
        hasSummaryData={hasSummaryData}
        isNoReplaySummary={isNoReplaySummary}
        summaryData={summaryData}
        segmentCount={segmentCount}
      />
    </Wrapper>
  );
}

function SummaryTextArea({
  isSummaryPending,
  hasError,
  errorMessage,
  summaryText,
  isNoReplaySummary,
}: {
  errorMessage: string;
  hasError: boolean;
  isNoReplaySummary: boolean;
  isSummaryPending: boolean;
  summaryText: string | undefined;
}) {
  const noSummaryMessageRef = useRef(
    NO_REPLAY_SUMMARY_MESSAGES[
      Math.floor(Math.random() * NO_REPLAY_SUMMARY_MESSAGES.length)
    ]
  );

  if (isSummaryPending) {
    return (
      <Flex flexGrow={1}>
        <Placeholder height="20px" />
      </Flex>
    );
  }

  if (hasError) {
    return <SummaryText>{errorMessage}</SummaryText>;
  }

  if (!summaryText || isNoReplaySummary) {
    return (
      <SummaryText>
        {isNoReplaySummary
          ? noSummaryMessageRef.current
          : t('No summary available for this replay.')}
      </SummaryText>
    );
  }

  return <SummaryText>{summaryText}</SummaryText>;
}

function SummaryContent({
  isSummaryPending,
  hasError,
  hasSummaryData,
  isNoReplaySummary,
  summaryData,
  segmentCount,
}: {
  hasError: boolean;
  hasSummaryData: boolean;
  isNoReplaySummary: boolean;
  isSummaryPending: boolean;
  segmentCount: number;
  summaryData: ReturnType<typeof useReplaySummaryContext>['summaryData'];
}) {
  if (isSummaryPending) {
    return <ReplaySummaryLoading />;
  }

  if (hasError || !hasSummaryData || isNoReplaySummary) {
    return (
      <EndStateContainer>
        <img src={aiBanner} alt="" />
      </EndStateContainer>
    );
  }

  return (
    <StyledTabItemContainer>
      <Container as="section" flex="1 1 auto" overflow="auto">
        <ChapterList timeRanges={summaryData!.data!.time_ranges} />
        {segmentCount > MAX_SEGMENTS_TO_SUMMARIZE && (
          <Subtext>
            {t('If a replay is too long, we may only summarize a small portion of it.')}
          </Subtext>
        )}
      </Container>
    </StyledTabItemContainer>
  );
}

function ThumbsUpDownButton({
  type,
  disabled,
}: {
  type: 'positive' | 'negative';
  disabled?: boolean;
}) {
  return (
    <FeedbackButton
      aria-label={t('Give feedback on the replay summary section')}
      icon={<IconThumb direction={type === 'positive' ? 'up' : 'down'} />}
      title={type === 'positive' ? t('I like this') : t(`I don't like this`)}
      size="xs"
      disabled={disabled}
      feedbackOptions={{
        messagePlaceholder:
          type === 'positive'
            ? t('What did you like about the replay summary and chapters?')
            : t('How can we make the replay summary and chapters work better for you?'),
        tags: {
          ['feedback.source']: 'replay_ai_summary',
          ['feedback.owner']: 'replay',
          ['feedback.type']: type,
        },
      }}
    >
      {undefined}
    </FeedbackButton>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  min-height: 0;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const Summary = styled('div')`
  padding: ${space(1)} ${space(1.5)};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const SummaryLeft = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const SummaryText = styled('p')`
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
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

const EndStateContainer = styled('div')`
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: ${space(4)};
  padding: ${space(2)};
  align-items: center;
  text-align: center;
`;

const Subtext = styled(Text)`
  padding: ${space(2)};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  display: flex;
  justify-content: center;
`;
