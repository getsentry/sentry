import {useEffect, useMemo} from 'react';

import {Flex} from 'sentry/components/container/flex';
import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
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
import {
  type SuspectFlagScore,
  useGroupSuspectFlagScores,
} from 'sentry/views/issueDetails/groupFeatureFlags/useGroupSuspectFlagScores';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {
  Container,
  StyledEmptyStateWarning,
} from 'sentry/views/issueDetails/groupTags/tagDrawerContent';

interface Props {
  debugSuspectScores: boolean;
  environments: string[];
  group: Group;
  orderBy: OrderBy;
  search: string;
  sortBy: SortBy;
}

export default function FlagDrawerContent({
  environments,
  group,
  orderBy,
  search,
  sortBy,
  debugSuspectScores,
}: Props) {
  const organization = useOrganization();

  // If we're showing the suspect section at all
  const enableSuspectFlags = organization.features.includes('feature-flag-suspect-flags');

  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useGroupFeatureFlags({
    groupId: group.id,
    environment: environments,
  });

  // Flatten all the tag values together into a big string.
  // Maybe for perf later, here we iterate over all tags&values once, (N*M) then
  // later only iterate through each tag (N) as the search term changes.
  const tagValues = useMemo(
    () =>
      data.reduce<Record<string, string>>((valueMap, tag) => {
        valueMap[tag.key] = tag.topValues
          .map(tv => tv.value)
          .join(' ')
          .toLowerCase();
        return valueMap;
      }, {}),
    [data]
  );

  const filteredFlags = useMemo(() => {
    const searchLower = search.toLowerCase();
    return data.filter(flag => {
      return (
        flag.name.includes(searchLower) ||
        flag.key.includes(searchLower) ||
        tagValues[flag.key]?.includes(searchLower)
      );
    });
  }, [data, search, tagValues]);

  const {data: suspectScores} = useGroupSuspectFlagScores({
    groupId: group.id,
    environment: environments.length ? environments : undefined,
    enabled: enableSuspectFlags || debugSuspectScores,
  });
  const suspectScoresMap = useMemo(
    () =>
      suspectScores
        ? Object.fromEntries(suspectScores.data.map(score => [score.flag, score]))
        : {},
    [suspectScores]
  );

  const sortedFlags = useMemo(() => {
    if (sortBy === SortBy.ALPHABETICAL) {
      const sorted = filteredFlags.toSorted((a, b) => a.key.localeCompare(b.key));
      return orderBy === OrderBy.A_TO_Z ? sorted : sorted.reverse();
    }
    if (sortBy === SortBy.SUSPICION) {
      return filteredFlags.toSorted(
        (a, b) =>
          (suspectScoresMap[b.key]?.score ?? 0) - (suspectScoresMap[a.key]?.score ?? 0)
      );
    }
    return filteredFlags;
  }, [filteredFlags, orderBy, sortBy, suspectScoresMap]);

  // CTA logic
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === group.project.slug)!;

  const showCTA =
    data.length === 0 &&
    project &&
    !project.hasFlags &&
    featureFlagOnboardingPlatforms.includes(project.platform ?? 'other');

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
    <FlagDrawerCTA projectPlatform={project.platform} />
  ) : data.length === 0 ? (
    <StyledEmptyStateWarning withIcon>
      {t('No feature flags were found for this issue')}
    </StyledEmptyStateWarning>
  ) : sortedFlags.length === 0 ? (
    <StyledEmptyStateWarning withIcon>
      {t('No feature flags were found for this search')}
    </StyledEmptyStateWarning>
  ) : (
    <Container>
      {sortedFlags.map(tag => (
        <div key={tag.key}>
          <FlagDetailsLink tag={tag} key={tag.key}>
            <TagDistribution tag={tag} key={tag.key} />
          </FlagDetailsLink>
          {debugSuspectScores && (
            <DebugSuspectScore scoreObj={suspectScoresMap[tag.key]} />
          )}
        </div>
      ))}
    </Container>
  );
}

function DebugSuspectScore({scoreObj}: {scoreObj: undefined | SuspectFlagScore}) {
  if (!scoreObj) {
    return null;
  }
  return (
    <Flex justify="space-between" w="100%">
      <span>Sus: {scoreObj.score.toFixed(5) ?? '_'}</span>
      <span>
        Baseline:{' '}
        {scoreObj.baseline_percent === undefined
          ? '_'
          : `${(scoreObj.baseline_percent * 100).toFixed(5)}%`}
      </span>
    </Flex>
  );
}
