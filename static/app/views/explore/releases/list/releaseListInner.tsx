import {Fragment} from 'react';
import {IconSearch} from '@sentry/icons/search';
import {parseAsString, useQueryState, useQueryStates} from 'nuqs';

import {Pagination} from '@sentry/scraps/pagination';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {Panel} from 'sentry/components/panels/panel';
import {getRelativeSummary} from 'sentry/components/timeRangeSelector/utils';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {HealthStatsPeriodOption, type Release} from 'sentry/types/release';
import {useLocation} from 'sentry/utils/useLocation';
import {isMobileRelease} from 'sentry/views/explore/releases/utils';

import {ReleaseCard} from './releaseCard';
import {ReleasesAdoptionChart} from './releasesAdoptionChart';
import {ReleasesDisplayOption} from './releasesDisplayOptions';
import {ReleasesPromo} from './releasesPromo';
import ReleasesRequest from './releasesRequest';
import {ReleasesStatusOption} from './releasesStatusOptions';
import {useReleasesSdkVersions} from './useReleasesSdkVersions';

interface Props {
  activeDisplay: ReleasesDisplayOption;
  activeQuery: string;
  activeSort: ReleasesSortOption;
  activeStatus: ReleasesStatusOption;
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

export function ReleaseListInner({
  activeDisplay,
  activeQuery,
  activeSort,
  activeStatus,
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
  const [healthStatsPeriod] = useQueryState('healthStatsPeriod', parseAsString);
  const [, setCursor] = useQueryState('cursor', parseAsString);
  const hasReleasesSetup = selectedProject?.features.includes('releases');
  const shouldShowLoadingIndicator =
    (loading && !reloading) || (loading && !releases?.length);
  const sdkVersionsByRelease = useReleasesSdkVersions({
    enabled: !shouldShowLoadingIndicator && !shouldShowQuickstart,
    organization,
    releases,
    selection,
  });

  if (shouldShowLoadingIndicator) {
    return <LoadingIndicator />;
  }

  if (!releases?.length && hasReleasesSetup) {
    return (
      <EmptyReleaseMessage
        activeQuery={activeQuery}
        activeSort={activeSort}
        activeStatus={activeStatus}
      />
    );
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
      display={[activeDisplay]}
      releasesReloading={reloading}
      healthStatsPeriod={
        healthStatsPeriod === null
          ? undefined
          : healthStatsPeriod === HealthStatsPeriodOption.TWENTY_FOUR_HOURS
            ? HealthStatsPeriodOption.TWENTY_FOUR_HOURS
            : HealthStatsPeriodOption.AUTO
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
                sdkVersions={sdkVersionsByRelease.get(release) ?? []}
                showHealthPlaceholders={isHealthLoading}
                isTopRelease={index === 0}
                getHealthData={getHealthData}
                showReleaseAdoptionStages={showReleaseAdoptionStages}
              />
            ))}
            <Pagination
              pageLinks={releasesPageLinks}
              onCursor={cursor => setCursor(cursor ?? null, {history: 'push'})}
            />
          </Fragment>
        );
      }}
    </ReleasesRequest>
  );
}

const emptyReleaseMessageParsers = {
  statsPeriod: parseAsString,
  start: parseAsString,
  end: parseAsString,
};

function EmptyReleaseMessage({
  activeQuery,
  activeSort,
  activeStatus,
}: {
  activeQuery: string;
  activeSort: ReleasesSortOption;
  activeStatus: ReleasesStatusOption;
}) {
  const [{statsPeriod, start, end}] = useQueryStates(emptyReleaseMessageParsers);

  const selectedPeriod =
    !!start && !!end
      ? t('time range')
      : getRelativeSummary(statsPeriod || DEFAULT_STATS_PERIOD).toLowerCase();

  if (activeQuery.length) {
    return (
      <Panel>
        <EmptyMessage icon={<IconSearch />} size="lg">{`${t(
          'There are no releases that match'
        )}: '${activeQuery}'.`}</EmptyMessage>
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
