import {useCallback, useMemo} from 'react';

import {Button} from 'sentry/components/core/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {featureFlagOnboardingPlatforms} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
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
  // Fetch data. Flags use the same endpoint and response type as tags, so we reuse some "tags" naming.
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

  // Suspect flag scores. This is a rudimentary INTERNAL-ONLY feature for testing our scoring algorithms.
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
      suspectScores?.data?.map(score => [score.flag, score]) ?? []
    );
  }, [suspectScores]);

  const getSuspectDisplay = useCallback(
    (flag: string) => {
      const scoreObj = suspectScoresMap[flag];
      return (
        <div>
          {`Suspicion Score: ${scoreObj?.score.toString() ?? '_'}`}
          <br />
          {`Baseline Percent: ${scoreObj?.baseline_percent === undefined ? '_' : `${scoreObj.baseline_percent * 100}%`}`}
        </div>
      );
    },
    [suspectScoresMap]
  );

  // Sort and filter results.
  const sortTags = useCallback(
    (tags: GroupTag[]) => {
      if (scoresEnabled && showScores === '1') {
        // Descending by score.
        return tags.toSorted(
          (t1, t2) =>
            (suspectScoresMap[t2.key]?.score ?? 0) -
            (suspectScoresMap[t1.key]?.score ?? 0)
        );
      }
      // Alphabetical by key.
      return tags.toSorted((t1, t2) => t1.key.localeCompare(t2.key));
    },
    [scoresEnabled, showScores, suspectScoresMap]
  );

  const displayTags = useMemo(() => {
    const sortedTags = sortTags(data);
    const searchedTags = sortedTags.filter(
      tag =>
        tag.key.includes(search) ||
        tag.name.includes(search) ||
        tagValues[tag.key]?.toLowerCase().includes(search.toLowerCase())
    );
    return searchedTags;
  }, [data, search, sortTags, tagValues]);

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
            {scoresEnabled && showScores === '1' && getSuspectDisplay(tag.key)}
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
