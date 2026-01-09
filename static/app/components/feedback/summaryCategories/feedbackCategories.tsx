import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Tag} from 'sentry/components/core/badge/tag';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import useFeedbackCategories from 'sentry/components/feedback/list/useFeedbackCategories';
import Placeholder from 'sentry/components/placeholder';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

function getSearchTermForLabel(label: string) {
  /**
   * Return exactly what we have to pass to the search API
   * The search API uses a very similar (almost exactly the same, except wildcards) escape logic to JSON.stringify, so doing it twice just "makes it work"
   * We search against a JSON-serialized array of all labels, this means:
   * - The first JSON.stringify is to give us the exact string we want to search for
   * - The search API considers backslashes and quotes special characters (similar to JSON), so we have to escape them again to indicate that we want to match them exactly
   * Special case: if the label has a literal * (asterisk) in it, we have to escape it to indicate that we want to match the literal *
   * - The asterisk escape is added after both JSON conversions, since otherwise, the \* would be escaped to \\* and would match the wildcard instead of the literal *
   */
  const toPassToSearch = escapeFilterValue(JSON.stringify(JSON.stringify(label)));
  // Now, add the wildcards to the string (second spot and second-last spot, since we want them inside the second pair of quotes)
  // The first and last quotes are added by the second JSON.stringify, we just manually add them back
  return `"${toPassToSearch.slice(1, -1)}"`;
}

function getSearchTermForLabelList(labels: string[]) {
  labels.sort();
  const searchTerms = labels.map(label => getSearchTermForLabel(label));
  return `[${searchTerms.join(',')}]`;
}

export default function FeedbackCategories() {
  const {isError, isPending, categories, tooFewFeedbacks} = useFeedbackCategories();
  // if we are showing this component, gen-ai-features must be true
  // and org.hideAiFeatures must be false,
  // but we still need to check that their seer acknowledgement exists
  const {setupAcknowledgement, isPending: isOrgSeerSetupPending} =
    useOrganizationSeerSetup();

  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();

  useEffect(() => {
    // Analytics for the rendered state. Should match the conditions below.
    if (isPending || isOrgSeerSetupPending || !setupAcknowledgement.orgHasAcknowledged) {
      return;
    }
    if (isError) {
      trackAnalytics('feedback.summary.categories-error', {
        organization,
      });
    } else if (tooFewFeedbacks) {
      trackAnalytics('feedback.summary.categories-too-few-feedbacks', {
        organization,
      });
    } else if (!categories || categories.length === 0) {
      trackAnalytics('feedback.summary.categories-empty', {
        organization,
      });
    } else {
      trackAnalytics('feedback.summary.categories-rendered', {
        organization,
        num_categories: categories.length,
      });
    }
  }, [
    organization,
    isError,
    tooFewFeedbacks,
    categories,
    setupAcknowledgement.orgHasAcknowledged,
    isPending,
    isOrgSeerSetupPending,
  ]);

  const currentQuery = useMemo(
    () => decodeScalar(location.query.query, ''),
    [location.query.query]
  );
  const searchConditions = useMemo(() => new MutableSearch(currentQuery), [currentQuery]);

  if (isPending || isOrgSeerSetupPending) {
    return <LoadingPlaceholder />;
  }

  // The assumption is that if categories are enabled, then summaries are definitely enabled.
  // Both are wrapped in a parent component. Summary has its own states for these cases, so we can just return null.
  if (
    isError ||
    tooFewFeedbacks ||
    !categories ||
    categories.length === 0 ||
    !setupAcknowledgement.orgHasAcknowledged
  ) {
    return null;
  }

  const isCategorySelected = (category: {
    associatedLabels: string[];
    primaryLabel: string;
  }) => {
    // Create search terms for primary label and all associated labels
    const allLabels = [category.primaryLabel, ...category.associatedLabels];
    const exactSearchTerm = getSearchTermForLabelList(allLabels);
    const currentFilters = searchConditions.getFilterValues('ai_categorization.labels');

    // Only show a tag as selected if it is the only filter, and the search term matches exactly
    return `[${currentFilters.map(c => `"${c}"`).join(',')}]` === exactSearchTerm;
  };

  const handleTagClick = (category: {
    associatedLabels: string[];
    primaryLabel: string;
  }) => {
    const allLabels = [category.primaryLabel, ...category.associatedLabels];

    const exactSearchTerm = getSearchTermForLabelList(allLabels);

    const isSelected = isCategorySelected(category);

    const newSearchConditions = new MutableSearch(currentQuery);

    if (isSelected) {
      newSearchConditions.removeFilter('ai_categorization.labels');
    } else {
      newSearchConditions.removeFilter('ai_categorization.labels');

      // Don't escape the search term, since we want wildcards to work; escape the string ourselves before adding the wildcards
      newSearchConditions.addContainsFilterValue(
        'ai_categorization.labels',
        exactSearchTerm,
        false
      );

      trackAnalytics('feedback.summary.category-selected', {
        organization,
        category: category.primaryLabel,
      });
    }

    navigate({
      ...location,
      query: {
        ...location.query,
        cursor: undefined,
        query: newSearchConditions.formatString(),
      },
    });
  };

  // TODO: after all feedbacks have the .labels tag, uncomment the feedback count
  return (
    <Flex wrap="wrap" gap="xs">
      {categories.map((category, index) => {
        const selected = isCategorySelected(category);
        return (
          <ClickableTag
            key={index}
            variant={selected ? 'info' : 'muted'}
            onClick={() => handleTagClick(category)}
            selected={selected}
          >
            {category.primaryLabel}
            {/* ({category.feedbackCount}) */}
          </ClickableTag>
        );
      })}
    </Flex>
  );
}

const ClickableTag = styled(Tag)<{selected: boolean}>`
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: none; /* Override the default max-width constraint */

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;

const LoadingPlaceholder = styled(Placeholder)`
  height: 16px;
  width: 100%;
  border-radius: ${p => p.theme.radius.md};
`;
