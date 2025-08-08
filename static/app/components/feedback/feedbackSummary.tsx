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

// This is an example of a valid array filter with wildcards, and we want to exact-match the quotes around the labels, so we have one backslash to escape the quotes (this should go to the search API) but another backslash in JS to actually include the backslash in the string
// const exampleFilter2 =
//   '["*\\"Sentry\\"*","*\\"User Interface\\"*","*\\"Integrations\\"*","\\"Annoying\\\"Quote\\""]';

// exampleFilter2

// const exampleFilter = '["*\\"Annoying\\\\\\"Quote\\"*"]';

// const exampleFilter = '["*\\"Annoying\\*Wildcard\\"*", "*\\"User Interface\\"*"]';

// Return exactly what we have to pass to the search API
// We search against a JSON-serialized array of all labels, this means:
// - The first JSON.stringify is to give us the exact string we want to search for (since the array we are substring matching against has JSON-serialized strings, that have quotes on either side, and the JSON.stringify gives us those quotes on either side)
// - But, the search API considers backslashes and quotes as special characters (similar to how JSON does), so we have to escape them again to indicate to search that they are exact matches, and not escape/special characters
// Special case: if the label has a literal * in it, we have to escape it to indicate to search that it is a literal *. Since otherwise, anything will be matched on the *
// Q: what if there is a literal \*, does escaping the backslash allow us to exact match on the backslash that's before the *?

// Notes:
// - Replacing * with \* does NOT work before JSON stringifying, because the \* is escaped to \\*, which actually ends up matching the wildcard and not the literal *
//   - Thus, we want exactly one \ before *, so we replace after both JSON stringifying, but this also means that the actual wildcard must be added after the final JSON stringify

// Key of this function is that the search API uses a very similar (almost exactly the same, except wildcards) escape logic to JSON.stringify, so doing it twice just "makes it work"
function getSearchTermForLabel(label: string) {
  const exactMatchString = JSON.stringify(label);
  let toPassToSearch = JSON.stringify(exactMatchString);
  // First, replace * with \* (this must be done after both JSON stringifies)
  toPassToSearch = toPassToSearch.replace('*', '\\*');
  // Now, add the wildcards to the string (second spot and second-last spot, since we want them inside the second pair of quotes)
  // The first and last quotes are added by the JSON.stringify, we just manually add them back
  toPassToSearch = `"*${toPassToSearch.slice(1, -1)}*"`;
  return toPassToSearch;
}

function getSearchTermForLabelList(labels: string[]) {
  const searchTerms = labels.map(label => getSearchTermForLabel(label));
  return `[${searchTerms.join(',')}]`;
}

// This works
// const exampleFilter = getSearchTermForLabelList(['Annoying*Wildcard']);

// Now try it with a literal backslash before the *
const exampleFilter = getSearchTermForLabelList(['Quote"And*Wildcard']);

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
    // Create search terms for primary label and all associated labels
    const allLabels = [category.primaryLabel, ...category.associatedLabels, 'Jira'];

    const labelFilters = allLabels.map(label => `*${JSON.stringify(label)}*`);

    // console.log('label filters', labelFilters);

    const newSearchConditions = new MutableSearch(currentQuery);

    // Check if this category is already selected (all labels must be present)
    const isSelected = labelFilters.every(filter => {
      // console.log(
      //   'filter',
      //   newSearchConditions.getFilterValues('ai_categorization.labels')[0]
      // );
      // console.log('this is the EXAMPLEFILTER', exampleFilter);
      // console.log(
      //   'is it equal to the filter?',
      //   newSearchConditions.getFilterValues('ai_categorization.labels')[0] ===
      //     exampleFilter
      // );

      return newSearchConditions
        .getFilterValues('ai_categorization.labels')
        .includes(filter);
    });

    if (isSelected) {
      // Remove all search terms if already selected
      labelFilters.forEach(filter => {
        newSearchConditions.removeFilterValue('ai_categorization.labels', filter);
      });
    } else {
      // Remove any existing ai_categorization.labels filters first
      newSearchConditions.removeFilter('ai_categorization.labels');
      // Create a single search term that matches any of the labels using regex-like OR syntax
      // const combinedFilter = `*${allLabels.map(label => JSON.stringify(label)).join('|')}*`;

      // we want literal backslashes in the string
      const filter = exampleFilter;

      // console.log('this is the test filter', filter);

      newSearchConditions.addFilterValue('ai_categorization.labels', filter, false);
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
    // Create search terms for primary label and all associated labels
    const allLabels = [category.primaryLabel, ...category.associatedLabels, 'Jira'];
    // Create the same combined filter pattern we use when adding
    const combinedFilter = `*${allLabels.map(label => JSON.stringify(label)).join('|')}*`;
    const currentFilters = searchConditions.getFilterValues('ai_categorization.labels');

    // Check if our combined filter pattern is in the current filters
    return currentFilters.includes(combinedFilter);
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
  max-width: none; /* Override the default max-width constraint */

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
