import {useEffect} from 'react';

import type {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {featureFlagOnboardingPlatforms} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import FlagDetailsLink from 'sentry/views/issueDetails/groupFeatureFlags/details/flagDetailsLink';
import FlagDrawerCTA from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerCTA';
import useGroupFlagDrawerData from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFlagDrawerData';
import {TagDistribution} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {
  Container,
  StyledEmptyStateWarning,
} from 'sentry/views/issueDetails/groupTags/tagDrawerContent';

interface Props {
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
}: Props) {
  const organization = useOrganization();

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
    <Container>
      {displayFlags.map(flag => (
        <div key={flag.key}>
          <FlagDetailsLink flag={flag} key={flag.key}>
            <TagDistribution tag={flag} key={flag.key} />
          </FlagDetailsLink>
        </div>
      ))}
    </Container>
  );
}
