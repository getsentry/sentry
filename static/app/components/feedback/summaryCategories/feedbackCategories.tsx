import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import type {FeedbackCategory} from 'sentry/components/feedback/list/useFeedbackCategories';
import {decodeScalar} from 'sentry/utils/queryString';
import {escapeFilterValue, MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

// This is an example of a valid array filter with wildcards, and we want to exact-match the quotes around the labels, so we have one backslash to escape the quotes (this should go to the search API) but another backslash in JS to actually include the backslash in the string
// const exampleFilter =
//   '["*\\"Sentry\\"*","*\\"User Interface\\"*","*\\"Integrations\\"*","\\"Annoying\\\"Quote\\""]';

// Return exactly what we have to pass to the search API
// We search against a JSON-serialized array of all labels, this means:
// - The first JSON.stringify is to give us the exact string we want to search for (since the array we are substring matching against has JSON-serialized strings, that have quotes on either side, and the JSON.stringify gives us those quotes on either side)
// - But, the search API considers backslashes and quotes as special characters (similar to how JSON does), so we have to escape them again to indicate to search that they are exact matches, and not escape/special characters
// Special case: if the label has a literal * in it, we have to escape it to indicate to search that it is a literal *. Since otherwise, anything will be matched on the *
// Q: what if there is a literal \*, does escaping the backslash allow us to exact match on the backslash that's before the *?

// Notes:
// - Replacing * with \* does NOT work before JSON stringifying, because the \* is escaped to \\*, which actually ends up matching the wildcard and not the literal *
//   - Thus, we want exactly one \ before *, so we replace after both JSON stringifying, but this also means that the actual wildcard must be added after the final JSON stringify

// The key of this function is that the search API uses a very similar (almost exactly the same, except wildcards) escape logic to JSON.stringify, so doing it twice just "makes it work"
function getSearchTermForLabel(label: string) {
  const exactMatchString = JSON.stringify(label);
  let toPassToSearch = JSON.stringify(exactMatchString);
  // First, replace * with \* (this must be done after both JSON stringifies)
  // TODO: use escapeFilterValue here because I think this only escapes the first one? wait idk
  // toPassToSearch = toPassToSearch.replace('*', '\\*');
  toPassToSearch = escapeFilterValue(toPassToSearch);
  // Now, add the wildcards to the string (second spot and second-last spot, since we want them inside the second pair of quotes)
  // The first and last quotes are added by the JSON.stringify, we just manually add them back
  toPassToSearch = `"*${toPassToSearch.slice(1, -1)}*"`;
  return toPassToSearch;
}

function getSearchTermForLabelList(labels: string[]) {
  labels.sort();
  const searchTerms = labels.map(label => getSearchTermForLabel(label));
  return `[${searchTerms.join(',')}]`;
}

export default function FeedbackCategories({
  categories,
}: {
  categories: FeedbackCategory[];
}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Get current search query from URL
  const currentQuery = useMemo(
    () => decodeScalar(location.query.query, ''),
    [location.query.query]
  );
  const searchConditions = useMemo(() => new MutableSearch(currentQuery), [currentQuery]);

  const handleTagClick = (category: {
    associatedLabels: string[];
    primaryLabel: string;
  }) => {
    // Create search terms for primary label and all associated labels
    const allLabels = [category.primaryLabel, ...category.associatedLabels];

    const exactSearchTerm = getSearchTermForLabelList(allLabels);

    const newSearchConditions = new MutableSearch(currentQuery);

    const isSelected = isTagOnlySelected(category);

    if (isSelected) {
      // Remove search term
      newSearchConditions.removeFilterValue('ai_categorization.labels', exactSearchTerm);
    } else {
      newSearchConditions.removeFilter('ai_categorization.labels');

      // Don't escape the search term, since we want wildcards to work. This means we escape the string ourselves before adding the wildcards
      newSearchConditions.addFilterValue(
        'ai_categorization.labels',
        exactSearchTerm,
        false
      );
    }

    // Update URL with new search query
    navigate({
      ...location,
      query: {
        ...location.query,
        cursor: undefined,
        query: newSearchConditions.formatString(),
      },
    });
  };

  const isTagOnlySelected = (category: {
    associatedLabels: string[];
    primaryLabel: string;
  }) => {
    // Create search terms for primary label and all associated labels
    const allLabels = [category.primaryLabel, ...category.associatedLabels];
    const exactSearchTerm = getSearchTermForLabelList(allLabels);
    const currentFilters = searchConditions.getFilterValues('ai_categorization.labels');

    // Only show a tag as selected if it is the only filter, and the search term matches exactly
    return currentFilters.length === 1 && currentFilters[0] === exactSearchTerm;
  };

  return (
    <TagsContainer>
      {categories.map((category, index) => {
        const selected = isTagOnlySelected(category);
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
  );
}

const TagsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.xs};
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
