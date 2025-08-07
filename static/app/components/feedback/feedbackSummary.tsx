import React from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import useFeedbackCategories from 'sentry/components/feedback/list/useFeedbackCategories';
import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconThumb} from 'sentry/icons';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

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
  const location = useLocation();
  const navigate = useNavigate();

  // Get current search query from URL
  const currentQuery = decodeScalar(location.query.query, '');
  const searchConditions = new MutableSearch(currentQuery);

  const handleTagClick = (category: {
    associatedLabels: string[];
    primaryLabel: string;
  }) => {
    // TODO: Replace with actual search terms logic
    const newSearchConditions = new MutableSearch(currentQuery);

    // Check if this category is already selected
    const isSelected = newSearchConditions
      .getFilterValues('category')
      .includes(category.primaryLabel);

    if (isSelected) {
      // Remove the search terms if already selected
      newSearchConditions.removeFilterValue('category', category.primaryLabel);
    } else {
      // Remove any existing category filter first (only one category at a time)
      newSearchConditions.removeFilter('category');
      // Add the new category
      newSearchConditions.addFilterValue('category', category.primaryLabel);
    }

    // Update URL with new search query
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: newSearchConditions.formatString(),
      },
    });
  };

  const isTagSelected = (category: {
    associatedLabels: string[];
    primaryLabel: string;
  }) => {
    // TODO: Replace with actual search terms logic
    return searchConditions.getFilterValues('category').includes(category.primaryLabel);
  };

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
              <TagsContainer>
                {categories.map((category, index) => {
                  const selected = isTagSelected(category);
                  return (
                    <ClickableTag
                      key={index}
                      type={selected ? 'info' : 'default'}
                      onClick={() => handleTagClick(category)}
                      selected={selected}
                    >
                      {category.primaryLabel} ({category.feedbackCount})
                    </ClickableTag>
                  );
                })}
              </TagsContainer>
            )}
          </React.Fragment>
        )}
      </SummaryContainer>
    </SummaryIconContainer>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: ${space(0.5)} 0 0 0;
`;

const LoadingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: center;
`;

const SummaryContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
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

const TagsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
`;

const ClickableTag = styled(Tag)<{selected: boolean}>`
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  ${p =>
    p.selected &&
    `
    border-width: 2px;
    font-weight: ${p.theme.fontWeight.bold};
  `}
`;

const SummaryIconContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  align-items: baseline;
`;
