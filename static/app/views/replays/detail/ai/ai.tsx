import styled from '@emotion/styled';

import loadingGif from 'sentry-images/spot/ai-loader.gif';
import aiBanner from 'sentry-images/spot/ai-suggestion-banner-stars.svg';
import replayEmptyState from 'sentry-images/spot/replays-empty-state.svg';

import AnalyticsArea, {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {IconSync, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {ChapterList} from 'sentry/views/replays/detail/ai/chapterList';
import {useReplaySummaryContext} from 'sentry/views/replays/detail/ai/replaySummaryContext';
import {NO_REPLAY_SUMMARY_MESSAGES} from 'sentry/views/replays/detail/ai/utils';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';

const MAX_SEGMENTS_TO_SUMMARIZE = 150;

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
  const analyticsArea = useAnalyticsArea();
  const skipConsentFlow = organization.features.includes('gen-ai-consent-flow-removal');

  const replayTooLongMessage = t(
    'If a replay is too long, we may only summarize a small portion of it.'
  );

  const {
    summaryData,
    isPending: isSummaryPending,
    isError,
    isTimedOut,
    startSummaryRequest,
  } = useReplaySummaryContext();

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

  // check for org seer setup first before attempting to fetch summary
  // only do this if consent flow is not skipped
  if (!skipConsentFlow && isOrgSeerSetupPending) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <LoadingContainer>
          <div>
            <img src={loadingGif} style={{maxHeight: 400}} alt={t('Loading...')} />
          </div>
        </LoadingContainer>
      </Wrapper>
    );
  }

  // If our `replay-ai-summaries` ff is enabled and the org has gen AI ff enabled,
  // but the org hasn't acknowledged the gen AI features, then show CTA.
  // only do this if consent flow is not skipped
  if (!skipConsentFlow && !setupAcknowledgement.orgHasAcknowledged) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EndStateContainer>
          <img src={aiBanner} alt="" />
          <div>
            <strong>{t('AI-Powered Replay Summaries')}</strong>
          </div>
          <div>
            {t(
              'Seer access is required to use replay summaries. Please view the Seer settings page for more information.'
            )}
          </div>
          <div>
            <LinkButton
              size="sm"
              priority="primary"
              to={`/settings/${organization.slug}/seer/`}
            >
              {t('View Seer Settings')}
            </LinkButton>
          </div>
        </EndStateContainer>
      </Wrapper>
    );
  }

  if (isError) {
    return (
      <AnalyticsArea name="error">
        <ErrorState
          organization={organization}
          startSummaryRequest={startSummaryRequest}
        />
      </AnalyticsArea>
    );
  }

  if (isTimedOut) {
    return (
      <AnalyticsArea name="timeout">
        <ErrorState
          organization={organization}
          startSummaryRequest={startSummaryRequest}
          extraMessage={t('timed out.')}
        />
      </AnalyticsArea>
    );
  }

  if (isSummaryPending) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <LoadingContainer>
          <div>
            <img src={loadingGif} style={{maxHeight: 400}} alt={t('Loading...')} />
          </div>
          <div>{t('This might take a few moments...')}</div>
        </LoadingContainer>
      </Wrapper>
    );
  }

  if (!summaryData?.data) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EndStateContainer>
          <img src={aiBanner} alt="" />
          <div>{t('No summary available for this replay.')}</div>
        </EndStateContainer>
      </Wrapper>
    );
  }

  if (
    summaryData.data.time_ranges.length <= 1 &&
    replay
      ?.getChapterFrames()
      ?.every(frame => 'category' in frame && frame.category === 'replay.init')
  ) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EndStateContainer>
          <img src={aiBanner} alt="" />
          <div>
            {
              NO_REPLAY_SUMMARY_MESSAGES[
                Math.floor(Math.random() * NO_REPLAY_SUMMARY_MESSAGES.length)
              ]
            }
          </div>
        </EndStateContainer>
      </Wrapper>
    );
  }

  return (
    <Wrapper data-test-id="replay-details-ai-summary-tab">
      <Summary>
        <SummaryLeft>
          <SummaryLeftTitle>
            <Flex align="center" gap="xs">
              {t('Replay Summary')}
            </Flex>
          </SummaryLeftTitle>
          <SummaryText>{summaryData.data.summary}</SummaryText>
        </SummaryLeft>
        <SummaryRight>
          <Flex gap="xs">
            <ThumbsUpDownButton type="positive" />
            <ThumbsUpDownButton type="negative" />
          </Flex>
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
            {t('Regenerate')}
          </Button>
        </SummaryRight>
      </Summary>
      <StyledTabItemContainer>
        <OverflowBody>
          <ChapterList timeRanges={summaryData.data.time_ranges} />
          {segmentCount > MAX_SEGMENTS_TO_SUMMARIZE && (
            <Subtext>{replayTooLongMessage}</Subtext>
          )}
        </OverflowBody>
      </StyledTabItemContainer>
    </Wrapper>
  );
}

function ErrorState({
  organization,
  startSummaryRequest,
  extraMessage,
}: {
  organization: Organization;
  startSummaryRequest: () => void;
  extraMessage?: string;
}) {
  const analyticsArea = useAnalyticsArea();

  return (
    <Wrapper data-test-id="replay-details-ai-summary-tab">
      <EndStateContainer>
        <img src={aiBanner} alt="" />
        <div>
          {extraMessage
            ? t('Failed to load replay summary - %s', extraMessage)
            : t('Failed to load replay summary.')}
        </div>
        <div>
          <Button
            priority="default"
            type="button"
            size="xs"
            onClick={() => {
              startSummaryRequest();
              trackAnalytics('replay.ai-summary.regenerate-requested', {
                organization,
                area: analyticsArea,
              });
            }}
            icon={<IconSync size="xs" />}
          >
            {t('Retry')}
          </Button>
        </div>
      </EndStateContainer>
    </Wrapper>
  );
}

function ThumbsUpDownButton({type}: {type: 'positive' | 'negative'}) {
  return (
    <FeedbackButton
      aria-label={t('Give feedback on the replay summary section')}
      icon={<IconThumb direction={type === 'positive' ? 'up' : 'down'} />}
      title={type === 'positive' ? t('I like this') : t(`I don't like this`)}
      size="xs"
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

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(4)};
  overflow: auto;
  text-align: center;
  flex-direction: column;
`;

const Summary = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
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
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  display: flex;
  justify-content: center;
`;
