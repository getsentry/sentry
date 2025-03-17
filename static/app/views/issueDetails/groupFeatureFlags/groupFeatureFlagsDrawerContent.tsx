import {useMemo} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import useGroupFeatureFlags from 'sentry/views/issueDetails/groupFeatureFlags/useGroupFeatureFlags';
import {
  Container,
  StyledEmptyStateWarning,
  Wrapper,
} from 'sentry/views/issueDetails/groupTags/groupTagsDrawer';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

/**
 * Ordering for tags in the drawer.
 */
function getSortedTags(tags: GroupTag[]) {
  // Alphabetical by key.
  return tags.toSorted((t1, t2) => t1.key.localeCompare(t2.key));
}

export default function GroupFeatureFlagsDrawerContent({
  group,
  environments,
  search,
}: {
  environments: string[];
  group: Group;
  search: string;
}) {
  // Flags use the same endpoint and response format as tags, so we reuse TagDistribution, tag types, and "tag" in variable names.
  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupFeatureFlags({
    groupId: group.id,
    environment: environments,
  });

  const tagValues = useMemo(
    () =>
      data.reduce<Record<string, string>>((valueMap, tag) => {
        valueMap[tag.key] = tag.topValues.map(tv => tv.value).join(' ');
        return valueMap;
      }, {}),
    [data]
  );

  const displayTags = useMemo(() => {
    const sortedTags = getSortedTags(data);
    const searchedTags = sortedTags.filter(
      tag =>
        tag.key.includes(search) ||
        tag.name.includes(search) ||
        tagValues[tag.key]?.toLowerCase().includes(search.toLowerCase())
    );
    return searchedTags;
  }, [data, search, tagValues]);

  return isPending ? (
    <LoadingIndicator />
  ) : isError ? (
    <LoadingError
      message={t('There was an error loading feature flags.')}
      onRetry={refetch}
    />
  ) : displayTags.length === 0 ? (
    <StyledEmptyStateWarning withIcon>
      {data.length === 0
        ? t('No feature flags were found for this issue')
        : t('No feature flags were found for this search')}
    </StyledEmptyStateWarning>
  ) : (
    <Wrapper>
      <Container>
        {displayTags.map((tag, tagIdx) => (
          <TagDistribution tag={tag} key={tagIdx} />
        ))}
      </Container>
    </Wrapper>
  );
}
