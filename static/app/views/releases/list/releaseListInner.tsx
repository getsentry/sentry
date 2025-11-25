import {Fragment} from 'react';
import type {Location} from 'history';

import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {HealthStatsPeriodOption, type Release} from 'sentry/types/release';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import ReleaseCard from 'sentry/views/releases/list/releaseCard';
import ReleasesAdoptionChart from 'sentry/views/releases/list/releasesAdoptionChart';
import {ReleasesDisplayOption} from 'sentry/views/releases/list/releasesDisplayOptions';
import ReleasesPromo from 'sentry/views/releases/list/releasesPromo';
import ReleasesRequest from 'sentry/views/releases/list/releasesRequest';
import {ReleasesStatusOption} from 'sentry/views/releases/list/releasesStatusOptions';
import {isMobileRelease} from 'sentry/views/releases/utils';

interface Props {
  activeDisplay: ReleasesDisplayOption;
  loading: boolean;
  organization: Organization;
  releases: Release[];
  releasesPageLinks: any;
  reloading: boolean;
  selectedProject: Project | undefined;
  selection: PageFilters;
  shouldShowQuickstart: boolean;
  showReleaseAdoptionStages: boolean;
}

function ReleaseListInner({
  activeDisplay,
  loading,
  organization,
  releases,
  releasesPageLinks,
  reloading,
  selectedProject,
  selection,
  shouldShowQuickstart,
  showReleaseAdoptionStages,
}: Props) {
  const location = useLocation();
  const hasReleasesSetup = selectedProject?.features.includes('releases');

  const shouldShowLoadingIndicator =
    (loading && !reloading) || (loading && !releases?.length);

  if (shouldShowLoadingIndicator) {
    return <LoadingIndicator />;
  }

  if (!releases?.length && hasReleasesSetup) {
    return <EmptyReleaseMessage location={location} selection={selection} />;
  }

  if (shouldShowQuickstart) {
    return <ReleasesPromo organization={organization} project={selectedProject!} />;
  }

  return (
    <ReleasesRequest
      releases={releases.map(({version}) => version)}
      organization={organization}
      selection={selection}
      location={location}
      display={[getDisplay(location)]}
      releasesReloading={reloading}
      healthStatsPeriod={
        typeof location.query.healthStatsPeriod === 'string'
          ? location.query.healthStatsPeriod === HealthStatsPeriodOption.TWENTY_FOUR_HOURS
            ? HealthStatsPeriodOption.TWENTY_FOUR_HOURS
            : HealthStatsPeriodOption.AUTO
          : undefined
      }
    >
      {({isHealthLoading, getHealthData}) => {
        const singleProjectSelected =
          selection.projects?.length === 1 &&
          selection.projects[0] !== ALL_ACCESS_PROJECTS;

        // TODO: project specific chart should live on the project details page.
        const isMobileProject =
          selectedProject?.platform && isMobileRelease(selectedProject.platform);

        return (
          <Fragment>
            {singleProjectSelected && selectedProject?.hasSessions && isMobileProject && (
              <ReleasesAdoptionChart
                organization={organization}
                selection={selection}
                location={location}
                activeDisplay={activeDisplay}
              />
            )}

            {releases.map((release, index) => (
              <ReleaseCard
                key={`${release.projects[0]!.slug}-${release.version}`}
                activeDisplay={activeDisplay}
                release={release}
                organization={organization}
                location={location}
                selection={selection}
                reloading={reloading}
                showHealthPlaceholders={isHealthLoading}
                isTopRelease={index === 0}
                getHealthData={getHealthData}
                showReleaseAdoptionStages={showReleaseAdoptionStages}
              />
            ))}
            <Pagination pageLinks={releasesPageLinks} />
          </Fragment>
        );
      }}
    </ReleasesRequest>
  );
}

export default ReleaseListInner;

function getQuery(location: Location) {
  const {query} = location.query;

  return typeof query === 'string' ? query : undefined;
}

function getSort(location: Location, selection: PageFilters): ReleasesSortOption {
  const {environments} = selection;
  const {sort} = location.query;

  // Require 1 environment for date adopted
  if (sort === ReleasesSortOption.ADOPTION && environments.length !== 1) {
    return ReleasesSortOption.DATE;
  }

  const sortExists =
    Boolean(sort) &&
    Object.values(ReleasesSortOption).includes(decodeScalar(sort) as ReleasesSortOption);
  if (sortExists) {
    return sort as ReleasesSortOption;
  }

  return ReleasesSortOption.DATE;
}

function getDisplay(location: Location): ReleasesDisplayOption {
  const {display} = location.query;

  switch (display) {
    case ReleasesDisplayOption.USERS:
      return ReleasesDisplayOption.USERS;
    default:
      return ReleasesDisplayOption.SESSIONS;
  }
}

function getStatus(location: Location): ReleasesStatusOption {
  const {status} = location.query;

  switch (status) {
    case ReleasesStatusOption.ARCHIVED:
      return ReleasesStatusOption.ARCHIVED;
    default:
      return ReleasesStatusOption.ACTIVE;
  }
}

function EmptyReleaseMessage({
  location,
  selection,
}: {
  location: Location;
  selection: PageFilters;
}) {
  const {statsPeriod, start, end} = location.query;
  const searchQuery = getQuery(location);
  const activeSort = getSort(location, selection);
  const activeStatus = getStatus(location);

  const selectedPeriod =
    !!start && !!end
      ? t('time range')
      : getRelativeSummary(
          decodeScalar(statsPeriod) || DEFAULT_STATS_PERIOD
        ).toLowerCase();

  if (searchQuery?.length) {
    return (
      <Panel>
        <EmptyMessage icon={<IconSearch />} size="lg">{`${t(
          'There are no releases that match'
        )}: '${searchQuery}'.`}</EmptyMessage>
      </Panel>
    );
  }

  if (activeSort === ReleasesSortOption.USERS_24_HOURS) {
    return (
      <Panel>
        <EmptyMessage icon={<IconSearch />} size="lg">
          {t('There are no releases with active user data (users in the last 24 hours).')}
        </EmptyMessage>
      </Panel>
    );
  }

  if (activeSort === ReleasesSortOption.SESSIONS_24_HOURS) {
    return (
      <Panel>
        <EmptyMessage icon={<IconSearch />} size="lg">
          {t(
            'There are no releases with active session data (sessions in the last 24 hours).'
          )}
        </EmptyMessage>
      </Panel>
    );
  }

  if (
    activeSort === ReleasesSortOption.BUILD ||
    activeSort === ReleasesSortOption.SEMVER
  ) {
    return (
      <Panel>
        <EmptyMessage icon={<IconSearch />} size="lg">
          {t('There are no releases with semantic versioning.')}
        </EmptyMessage>
      </Panel>
    );
  }

  if (activeSort !== ReleasesSortOption.DATE) {
    return (
      <Panel>
        <EmptyMessage icon={<IconSearch />} size="lg">
          {`${t('There are no releases with data in the')} ${selectedPeriod}.`}
        </EmptyMessage>
      </Panel>
    );
  }

  if (activeStatus === ReleasesStatusOption.ARCHIVED) {
    return (
      <Panel>
        <EmptyMessage icon={<IconSearch />} size="lg">
          {t('There are no archived releases.')}
        </EmptyMessage>
      </Panel>
    );
  }

  return (
    <Panel>
      <EmptyMessage icon={<IconSearch />} size="lg">
        {`${t('There are no releases with data in the')} ${selectedPeriod}.`}
      </EmptyMessage>
    </Panel>
  );
}
