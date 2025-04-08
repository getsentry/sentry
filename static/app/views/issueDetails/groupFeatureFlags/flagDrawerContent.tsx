import {useEffect, useMemo} from 'react';

import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {featureFlagOnboardingPlatforms} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import FlagDetailsLink from 'sentry/views/issueDetails/groupFeatureFlags/flagDetailsLink';
import FlagDrawerCTA from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerCTA';
import useGroupFeatureFlags from 'sentry/views/issueDetails/groupFeatureFlags/useGroupFeatureFlags';
import {useGroupSuspectFlagScores} from 'sentry/views/issueDetails/groupFeatureFlags/useGroupSuspectFlagScores';
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

const SHOW_SCORES_LOCAL_STORAGE_KEY = 'flag-drawer-show-suspicion-scores';

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
  const [showScores, setShowScores] = useLocalStorageState(
    SHOW_SCORES_LOCAL_STORAGE_KEY,
    '0'
  );

  const organization = useOrganization();
  const scoresEnabled =
    organization.features.includes('suspect-scores-sandbox-ui') &&
    organization.features.includes('feature-flag-suspect-flags');

  const {data: suspectScores} = useGroupSuspectFlagScores({
    groupId: group.id,
    environment: environments.length ? environments : undefined,
    enabled: scoresEnabled && showScores === '1',
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
    <div>
      <Container>
        {displayTags.map(tag => (
          <div key={tag.key}>
            <FlagDetailsLink tag={tag} key={tag.key}>
              <TagDistribution tag={tag} key={tag.key} />
            </FlagDetailsLink>
            {scoresEnabled && showScores === '1' && (
              <div>{`Suspicion Score: ${suspectScoresMap[tag.key] ?? 'unknown'}`}</div>
            )}
          </div>
        ))}
      </Container>
      {scoresEnabled && (
        <Button onClick={() => setShowScores(showScores === '1' ? '0' : '1')}>
          {showScores === '1' ? t('Hide Suspicion Scores') : t('Show Suspicion Scores')}
        </Button>
      )}
    </div>
  );
}
