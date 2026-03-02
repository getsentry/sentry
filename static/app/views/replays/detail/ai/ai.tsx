import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import aiBanner from 'sentry-images/spot/ai-suggestion-banner-stars.svg';
import replayEmptyState from 'sentry-images/spot/replays-empty-state.svg';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import Placeholder from 'sentry/components/placeholder';
import {IconSync, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
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
      <Stack
        wrap="nowrap"
        minHeight="0"
        border="primary"
        radius="md"
        data-test-id="replay-details-ai-summary-tab"
      >
        <Stack overflow="auto" gap="3xl" padding="xl" align="center">
          <img src={replayEmptyState} height={300} alt="" />
          <Text align="center">
            {t('Project not found. Unable to load replay summary.')}
          </Text>
        </Stack>
      </Stack>
    );
  }

  if (!organization.features.includes('replay-ai-summaries') || !areAiFeaturesAllowed) {
    return (
      <Stack
        wrap="nowrap"
        minHeight="0"
        border="primary"
        radius="md"
        data-test-id="replay-details-ai-summary-tab"
      >
        <Stack overflow="auto" gap="3xl" padding="xl" align="center">
          <img src={replayEmptyState} height={300} alt="" />
          <Text align="center">
            {areAiFeaturesAllowed
              ? t('Replay summaries are not available for this organization.')
              : t('AI features are not available for this organization.')}
          </Text>
        </Stack>
      </Stack>
    );
  }

  const hasError = isError || isTimedOut;
  const hasInsufficientReplayFrames = Boolean(
    !summaryData?.data || (summaryData.data?.time_ranges.length <= 1 && onlyInitFrames)
  );
  const feedbackDisabled = isSummaryPending || hasError || hasInsufficientReplayFrames;

  const errorMessage = isTimedOut
    ? t('Failed to load replay summary - timed out.')
    : t('Failed to load replay summary.');

  return (
    <Stack
      wrap="nowrap"
      minHeight="0"
      border="primary"
      radius="md"
      data-test-id="replay-details-ai-summary-tab"
    >
      <Container padding="md lg" borderBottom="primary">
        <Stack gap="xs">
          <Flex align="center" justify="between">
            <Text size="lg" bold>
              {t('Replay Summary')}
            </Text>
            <Button
              priority="default"
              type="button"
              size="xs"
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
              hasInsufficientReplayFrames={hasInsufficientReplayFrames}
            />
            <Flex gap="xs" flexShrink={0}>
              <ThumbsUpDownButton type="positive" disabled={feedbackDisabled} />
              <ThumbsUpDownButton type="negative" disabled={feedbackDisabled} />
            </Flex>
          </Flex>
        </Stack>
      </Container>
      <SummaryContent
        isSummaryPending={isSummaryPending}
        hasError={hasError}
        errorMessage={errorMessage}
        hasInsufficientReplayFrames={hasInsufficientReplayFrames}
        summaryData={summaryData}
        segmentCount={segmentCount}
      />
    </Stack>
  );
}

function SummaryTextArea({
  isSummaryPending,
  hasError,
  errorMessage,
  summaryText,
  hasInsufficientReplayFrames,
}: {
  errorMessage: string;
  hasError: boolean;
  hasInsufficientReplayFrames: boolean;
  isSummaryPending: boolean;
  summaryText: string | undefined;
}) {
  if (hasError) {
    return (
      <Text as="p" size="md" variant="secondary" wrap="pre-wrap" density="comfortable">
        {errorMessage}
      </Text>
    );
  }

  if (isSummaryPending) {
    return (
      <Flex flexGrow={1}>
        <Placeholder height="20px" />
      </Flex>
    );
  }

  if (!summaryText || hasInsufficientReplayFrames) {
    return (
      <Text as="p" size="md" variant="secondary" wrap="pre-wrap" density="comfortable">
        {t('No summary available for this replay.')}
      </Text>
    );
  }

  return (
    <Text as="p" size="md" variant="secondary" wrap="pre-wrap" density="comfortable">
      {summaryText}
    </Text>
  );
}

function SummaryContent({
  isSummaryPending,
  hasError,
  errorMessage,
  hasInsufficientReplayFrames,
  summaryData,
  segmentCount,
}: {
  errorMessage: string;
  hasError: boolean;
  hasInsufficientReplayFrames: boolean;
  isSummaryPending: boolean;
  segmentCount: number;
  summaryData: ReturnType<typeof useReplaySummaryContext>['summaryData'];
}) {
  if (hasError) {
    return (
      <Stack overflow="auto" gap="3xl" padding="xl" align="center">
        <img src={aiBanner} alt="" />
        <Text align="center">{errorMessage}</Text>
      </Stack>
    );
  }

  if (isSummaryPending) {
    return <ReplaySummaryLoading />;
  }

  if (hasInsufficientReplayFrames) {
    return (
      <Stack overflow="auto" gap="3xl" padding="xl" align="center">
        <NoReplaySummary />
      </Stack>
    );
  }

  return (
    <StyledTabItemContainer>
      <Container as="section" flex="1 1 auto" overflow="auto">
        <ChapterList timeRanges={summaryData!.data!.time_ranges} />
        {segmentCount > MAX_SEGMENTS_TO_SUMMARIZE && (
          <Flex justify="center" padding="xl">
            <Text size="sm" variant="secondary">
              {t('If a replay is too long, we may only summarize a small portion of it.')}
            </Text>
          </Flex>
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
      tooltipProps={{
        title: type === 'positive' ? t('I like this') : t(`I don't like this`),
      }}
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

/**
 * Due to the random message generation, the component can show a new message on each render. This is not ideal because we
 * cause a lot of re-renders when the replay is played.
 *
 * Use `useRef` to store the message so that it is not changed after the initial render. (Alternatively, React.memo or React Compiler would also work)
 */
function NoReplaySummary() {
  const noSummaryMessageRef = useRef(
    NO_REPLAY_SUMMARY_MESSAGES[
      Math.floor(Math.random() * NO_REPLAY_SUMMARY_MESSAGES.length)
    ]
  );

  return (
    <Fragment>
      <img src={aiBanner} alt="" />
      <div>{noSummaryMessageRef.current}</div>
    </Fragment>
  );
}

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
