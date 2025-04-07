import {useMemo} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {featureFlagOnboardingPlatforms} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
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
import {useSuspectFlagScores} from 'sentry/views/issueDetails/streamline/hooks/featureFlags/useSuspectFlagScores';

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

  // Suspect flag scoring. This a rudimentary INTERNAL-ONLY display for testing our scoring algorithms.
  const organization = useOrganization();
  const showScores = organization.features.includes(
    'organizations:suspect-scores-sandbox-ui'
  );

  const {data: suspectScores} = useSuspectFlagScores({
    group,
    environment: environments.length ? environments : undefined,
    enabled: showScores,
  });

  const suspectScoresMap = useMemo(() => {
    return Object.fromEntries(
      suspectScores?.data?.map(score => [score.flag, score.score]) ?? []
    );
  }, [suspectScores]);

  // CTA logic
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === group.project.slug)!;

  const showCTA =
    data.length === 0 &&
    project &&
    !project.hasFlags &&
    featureFlagOnboardingPlatforms.includes(project.platform ?? 'other');

  return isPending ? (
    <LoadingIndicator />
  ) : isError ? (
    <LoadingError
      message={t('There was an error loading feature flags.')}
      onRetry={refetch}
    />
  ) : showCTA ? (
    <FlagDrawerCTA />
  ) : displayTags.length === 0 ? (
    <StyledEmptyStateWarning withIcon>
      {data.length === 0
        ? t('No feature flags were found for this issue')
        : t('No feature flags were found for this search')}
    </StyledEmptyStateWarning>
  ) : (
    <Container>
      {displayTags.map(tag => (
        <div key={tag.key}>
          <FlagDetailsLink tag={tag} key={tag.key}>
            <TagDistribution tag={tag} key={tag.key} />
          </FlagDetailsLink>
          {showScores && (
            <div>{`Suspicion Score: ${suspectScoresMap[tag.key] ?? 'unknown'}`}</div>
          )}
        </div>
      ))}
    </Container>
  );
}
