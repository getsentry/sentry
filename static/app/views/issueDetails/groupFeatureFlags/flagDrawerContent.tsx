import {useEffect, useMemo} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {featureFlagOnboardingPlatforms} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import FlagDetailsLink from 'sentry/views/issueDetails/groupFeatureFlags/flagDetailsLink';
import FlagDrawerCTA from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerCTA';
import useGroupFeatureFlags from 'sentry/views/issueDetails/groupFeatureFlags/useGroupFeatureFlags';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {
  Container,
  StyledEmptyStateWarning,
} from 'sentry/views/issueDetails/groupTags/tagDrawerContent';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

/**
 * Ordering for flags in the drawer.
 */
function getSortedTags(tags: GroupTag[]) {
  // Alphabetical by key.
  return tags.toSorted((t1, t2) => t1.key.localeCompare(t2.key));
}

export default function FlagDrawerContent({
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

  const {projects} = useProjects();
  const project = projects.find(p => p.slug === group.project.slug)!;

  const showCTA =
    data.length === 0 &&
    project &&
    !project.hasFlags &&
    featureFlagOnboardingPlatforms.includes(project.platform ?? 'other');

  const organization = useOrganization();

  useEffect(() => {
    if (!isPending && !isError && !showCTA) {
      trackAnalytics('flags.drawer_rendered', {
        organization,
        numFlags: data.length,
      });
    }
  }, [organization, data.length, isPending, isError, showCTA]);

  return isPending ? (
    <LoadingIndicator />
  ) : isError ? (
    <LoadingError
      message={t('There was an error loading feature flags.')}
      onRetry={refetch}
    />
  ) : showCTA ? (
    <FlagDrawerCTA />
  ) : data.length === 0 ? (
    <StyledEmptyStateWarning withIcon>
      {t('No feature flags were found for this issue')}
    </StyledEmptyStateWarning>
  ) : displayTags.length === 0 ? (
    <StyledEmptyStateWarning withIcon>
      {t('No feature flags were found for this search')}
    </StyledEmptyStateWarning>
  ) : (
    <Container>
      {displayTags.map(tag => (
        <div key={tag.name}>
          <FlagDetailsLink tag={tag} key={tag.name}>
            <TagDistribution tag={tag} key={tag.name} />
          </FlagDetailsLink>
        </div>
      ))}
    </Container>
  );
}
