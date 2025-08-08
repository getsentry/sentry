import React from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import useFeedbackCategories from 'sentry/components/feedback/list/useFeedbackCategories';
import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import FeedbackCategories from 'sentry/components/feedback/summaryCategories/feedbackCategories';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconThumb} from 'sentry/icons';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

export default function FeedbackSummary() {
  const {
    isError: isSummaryError,
    isPending: isSummaryPending,
    summary,
    tooFewFeedbacks: tooFewFeedbacksSummary,
    numFeedbacksUsed,
  } = useFeedbackSummary();

  const {
    isError: isCategoriesError,
    isPending: isCategoriesPending,
    categories,
    tooFewFeedbacks: tooFewFeedbacksCategories,
  } = useFeedbackCategories();

  const openForm = useFeedbackForm();

  const feedbackButton = ({type}: {type: 'positive' | 'negative'}) => {
    return openForm ? (
      <Button
        aria-label={t('Give feedback on the AI-powered summary')}
        icon={<IconThumb direction={type === 'positive' ? 'up' : 'down'} />}
        title={type === 'positive' ? t('I like this') : t(`I don't like this`)}
        size={'xs'}
        onClick={() =>
          openForm({
            messagePlaceholder:
              type === 'positive'
                ? t('What did you like about the AI-powered summary?')
                : t('How can we make the summary work better for you?'),
            tags: {
              ['feedback.source']: 'feedback_ai_summary',
              ['feedback.owner']: 'replay',
              ['feedback.type']: type,
              ['feedback.num_feedbacks_used']: numFeedbacksUsed,
            },
          })
        }
      />
    ) : null;
  };

  const isPending = isSummaryPending || isCategoriesPending;
  const isError = isSummaryError || isCategoriesError;
  const tooFewFeedbacks = tooFewFeedbacksSummary || tooFewFeedbacksCategories;

  return (
    <SummaryIconContainer>
      <IconSeer size="xs" />
      <SummaryContainer>
        <Flex justify="between" align="center">
          <SummaryHeader>{t('Summary')}</SummaryHeader>
          <Flex gap="xs">
            {feedbackButton({type: 'positive'})}
            {feedbackButton({type: 'negative'})}
          </Flex>
        </Flex>

        {isPending ? (
          <LoadingContainer>
            <StyledLoadingIndicator size={24} />
            <SummaryContent>{t('Summarizing feedback received...')}</SummaryContent>
          </LoadingContainer>
        ) : tooFewFeedbacks ? (
          <SummaryContent>
            {t('Bummer... Not enough feedback to summarize (yet).')}
          </SummaryContent>
        ) : isError ? (
          <SummaryContent>{t('Error summarizing feedback.')}</SummaryContent>
        ) : (
          <React.Fragment>
            <SummaryContent>{summary}</SummaryContent>
            {categories && categories.length > 0 && (
              <FeedbackCategories categories={categories} />
            )}
          </React.Fragment>
        )}
      </SummaryContainer>
    </SummaryIconContainer>
  );
}
const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: ${p => p.theme.space.xs} 0 0 0;
`;

const LoadingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

const SummaryContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  width: 100%;
`;

const SummaryHeader = styled('p')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
`;

const SummaryContent = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin: 0;
`;

const SummaryIconContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.xl};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  align-items: baseline;
`;
