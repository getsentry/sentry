import {Fragment, useEffect} from 'react';

import {Flex} from 'sentry/components/container/flex';
import type {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {featureFlagOnboardingPlatforms} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import SuspectTable from 'sentry/views/issueDetails/groupDistributions/suspectTable';
import FlagDetailsLink from 'sentry/views/issueDetails/groupFeatureFlags/details/flagDetailsLink';
import FlagDrawerCTA from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerCTA';
import useGroupFlagDrawerData from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFlagDrawerData';
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
  debugSuspectScores,
  environments,
  group,
  orderBy,
  search,
  sortBy,
}: Props) {
  const organization = useOrganization();

  // If we're showing the suspect section at all
  const enableSuspectFlags = organization.features.includes('feature-flag-suspect-flags');

  const {displayFlags, allGroupFlagCount, isPending, isError, refetch} =
    useGroupFlagDrawerData({
      environments,
      group,
      orderBy,
      search,
      sortBy,
    });

  // CTA logic
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === group.project.slug)!;

  const showCTA =
    allGroupFlagCount === 0 &&
    project &&
    !project.hasFlags &&
    featureFlagOnboardingPlatforms.includes(project.platform ?? 'other');

  useEffect(() => {
    if (!isPending && !isError && !showCTA) {
      trackAnalytics('flags.drawer_rendered', {
        organization,
        numFlags: allGroupFlagCount,
      });
    }
  }, [organization, allGroupFlagCount, isPending, isError, showCTA]);

  return isPending ? (
    <LoadingIndicator />
  ) : isError ? (
    <LoadingError
      message={t('There was an error loading feature flags.')}
      onRetry={refetch}
    />
  ) : showCTA ? (
    <FlagDrawerCTA projectPlatform={project.platform} />
  ) : allGroupFlagCount === 0 ? (
    <StyledEmptyStateWarning withIcon>
      {t('No feature flags were found for this issue')}
    </StyledEmptyStateWarning>
  ) : displayFlags.length === 0 ? (
    <StyledEmptyStateWarning withIcon>
      {t('No feature flags were found for this search')}
    </StyledEmptyStateWarning>
  ) : (
    <Fragment>
      {enableSuspectFlags ? (
        <SuspectTable
          debugSuspectScores={debugSuspectScores}
          environments={environments}
          group={group}
        />
      ) : null}
      <Container>
        {displayFlags.map(flag => (
          <div key={flag.key}>
            <FlagDetailsLink tag={flag} key={flag.key}>
              <TagDistribution tag={flag} key={flag.key} />
            </FlagDetailsLink>
            {debugSuspectScores && <DebugSuspectScore {...flag.suspect} />}
          </div>
        ))}
      </Container>
    </Fragment>
  );
}

function DebugSuspectScore({
  baselinePercent,
  score,
}: {
  baselinePercent: undefined | number;
  score: undefined | number;
}) {
  return (
    <Flex justify="space-between" w="100%">
      <span>Sus: {score?.toFixed(5) ?? '_'}</span>
      <span>
        Baseline:{' '}
        {baselinePercent === undefined ? '_' : `${(baselinePercent * 100).toFixed(5)}%`}
      </span>
    </Flex>
  );
}
