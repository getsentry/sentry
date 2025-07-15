import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconSeer, IconSync, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {ChapterList} from 'sentry/views/replays/detail/ai/chapterList';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';

import {useFetchReplaySummary} from './useFetchReplaySummary';

export default function Ai() {
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
    staleTime: 0,
    enabled: Boolean(
      replayRecord?.id &&
        project?.slug &&
        organization.features.includes('replay-ai-summaries') &&
        organization.features.includes('gen-ai-features')
    ),
    retry: false,
  });

  const openForm = useFeedbackForm();

  const feedbackButton = ({type}: {type: 'positive' | 'negative'}) => {
    return openForm ? (
      <Button
        aria-label={t('Give feedback on the AI summary section')}
        icon={<IconThumb direction={type === 'positive' ? 'up' : 'down'} />}
        title={type === 'positive' ? t('I like this') : t(`I don't like this`)}
        size={'xs'}
        onClick={() =>
          openForm({
            messagePlaceholder:
              type === 'positive'
                ? t('What did you like about the AI summary and chapters?')
                : t('How can we make the AI summary and chapters work better for you?'),
            tags: {
              ['feedback.source']: 'replay_ai_summary',
              ['feedback.owner']: 'replay',
              ['feedback.type']: type,
            },
          })
        }
      />
    ) : null;
  };

  if (
    !organization.features.includes('replay-ai-summaries') ||
    !organization.features.includes('gen-ai-features')
  ) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EmptySummaryContainer>
          <Alert type="info">
            {t('Replay AI summary is not available for this organization.')}
          </Alert>
        </EmptySummaryContainer>
      </Wrapper>
    );
  }

  if (replayRecord?.project_id && !project) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EmptySummaryContainer>
          <Alert type="error">{t('Project not found. Unable to load AI summary.')}</Alert>
        </EmptySummaryContainer>
      </Wrapper>
    );
  }

  if (isPending || isRefetching) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <LoadingContainer>
          <LoadingIndicator />
        </LoadingContainer>
      </Wrapper>
    );
  }

  if (isError) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EmptySummaryContainer>
          <Alert type="error">{t('Failed to load AI summary')}</Alert>
        </EmptySummaryContainer>
      </Wrapper>
    );
  }

  if (!summaryData) {
    return (
      <Wrapper data-test-id="replay-details-ai-summary-tab">
        <EmptySummaryContainer>
          <Alert type="info">{t('No summary available for this replay.')}</Alert>
        </EmptySummaryContainer>
      </Wrapper>
    );
  }

  return (
    <Wrapper data-test-id="replay-details-ai-summary-tab">
      <Summary>
        <SummaryLeft>
          <SummaryLeftTitle>
            <Flex align="center" gap={space(0.5)}>
              {t('Replay Summary')}
              <IconSeer />
            </Flex>
            <Badge type="internal">{t('Internal')}</Badge>
          </SummaryLeftTitle>
          <SummaryText>{summaryData.data.summary}</SummaryText>
        </SummaryLeft>
        <SummaryRight>
          <Flex gap={space(0.5)}>
            {feedbackButton({type: 'positive'})}
            {feedbackButton({type: 'negative'})}
          </Flex>
          <Button
            priority="default"
            type="button"
            size="xs"
            onClick={() => refetch()}
            icon={<IconSync size="xs" />}
          >
            {t('Regenerate')}
          </Button>
        </SummaryRight>
      </Summary>
      <StyledTabItemContainer>
        <OverflowBody>
          <ChapterList summaryData={summaryData} />
        </OverflowBody>
      </StyledTabItemContainer>
    </Wrapper>
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
