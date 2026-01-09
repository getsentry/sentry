import {Fragment, useContext} from 'react';
import styled from '@emotion/styled';
import type {Location, LocationDescriptor} from 'history';
import moment from 'moment-timezone';

import {restoreRelease} from 'sentry/actionCreators/release';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {useSessionsRequest} from 'sentry/components/charts/useSessionsRequest';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {DateTime} from 'sentry/components/dateTime';
import type {DropdownOption} from 'sentry/components/discover/transactionsList';
import TransactionsList from 'sentry/components/discover/transactionsList';
import * as Layout from 'sentry/components/layouts/thirds';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import type {ChangeData} from 'sentry/components/timeRangeSelector';
import {TimeRangeSelector} from 'sentry/components/timeRangeSelector';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {NewQuery, Organization} from 'sentry/types/organization';
import {SessionFieldWithOperation} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getUtcDateString} from 'sentry/utils/dates';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';
import type {TrendView} from 'sentry/views/performance/trends/types';
import {TrendChangeType} from 'sentry/views/performance/trends/types';
import {
  getReleaseParams,
  isReleaseArchived,
  searchReleaseVersion,
} from 'sentry/views/releases/utils';

import {ReleaseContext} from '..';

import CommitAuthorBreakdown from './sidebar/commitAuthorBreakdown';
import Deploys from './sidebar/deploys';
import OtherProjects from './sidebar/otherProjects';
import ProjectReleaseDetails from './sidebar/projectReleaseDetails';
import ReleaseAdoption from './sidebar/releaseAdoption';
import ReleaseStats from './sidebar/releaseStats';
import TotalCrashFreeUsers from './sidebar/totalCrashFreeUsers';
import ReleaseArchivedNotice from './releaseArchivedNotice';
import ReleaseComparisonChart from './releaseComparisonChart';
import ReleaseIssues from './releaseIssues';

const RELEASE_PERIOD_KEY = 'release';

export enum TransactionsListOption {
  FAILURE_COUNT = 'failure_count',
  TPM = 'tpm',
  SLOW = 'slow',
  SLOW_LCP = 'slow_lcp',
  REGRESSION = 'regression',
  IMPROVEMENT = 'improved',
}

type RouteParams = {
  orgId: string;
  release: string;
};

function ReleaseOverview() {
  const {
    release,
    project,
    deploys,
    releaseMeta,
    refetchData,
    hasHealthData,
    releaseBounds,
  } = useContext(ReleaseContext);
  const params = useParams<RouteParams>();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const router = useRouter();
  const api = useApi();

  const {commitCount, version} = release;
  const sessionsRequestProps = {
    field: [
      SessionFieldWithOperation.USERS,
      SessionFieldWithOperation.SESSIONS,
      SessionFieldWithOperation.DURATION,
    ],
    groupBy: ['session.status'],
    ...getReleaseParams({location, releaseBounds}),
    shouldFilterSessionsInTimeWindow: true,
  };

  const {
    isPending: allReleasesLoading,
    isLoading: allReleasesReloading,
    isError: allReleasesErrored,
    data: allReleases,
  } = useSessionsRequest(sessionsRequestProps);

  const {
    isPending: thisReleaseLoading,
    isLoading: thisReleaseReloading,
    isError: thisReleaseErrored,
    data: thisRelease,
  } = useSessionsRequest({
    ...sessionsRequestProps,
    query: searchReleaseVersion(version),
  });

  const getPageDateTime = (): DateTimeObject => {
    const query = location.query;

    const {start, end, statsPeriod} = normalizeDateTimeParams(query, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
      allowAbsolutePageDatetime: true,
    });

    if (statsPeriod) {
      return {period: statsPeriod};
    }

    if (start && end) {
      return {
        start: moment.utc(start).format(),
        end: moment.utc(end).format(),
      };
    }

    return {};
  };

  const handleRestore = async (successCallback: () => void) => {
    try {
      await restoreRelease(new Client(), {
        orgSlug: organization.slug,
        projectSlug: project.slug,
        releaseVersion: params.release,
      });
      successCallback();
    } catch {
      // do nothing, action creator is already displaying error message
    }
  };

  const getReleaseEventView = (
    projectId: number,
    selectedSort: DropdownOption
  ): EventView => {
    const {environments} = selection;

    const {start, end, statsPeriod} = getReleaseParams({
      location,
      releaseBounds,
    });

    const baseQuery: NewQuery = {
      id: undefined,
      version: 2,
      name: `Release ${formatVersion(version)}`,
      query: `event.type:transaction ${searchReleaseVersion(version)}`,
      fields: ['transaction', 'failure_count()', 'epm()', 'p50()'],
      orderby: '-failure_count',
      range: statsPeriod || undefined,
      environment: environments,
      projects: [projectId],
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    };

    switch (selectedSort.value) {
      case TransactionsListOption.SLOW_LCP:
        return EventView.fromSavedQuery({
          ...baseQuery,
          query: `event.type:transaction release:${version} epm():>0.01 has:measurements.lcp`,
          fields: ['transaction', 'failure_count()', 'epm()', 'p75(measurements.lcp)'],
          orderby: 'p75_measurements_lcp',
        });
      case TransactionsListOption.SLOW:
        return EventView.fromSavedQuery({
          ...baseQuery,
          query: `event.type:transaction release:${version} epm():>0.01`,
        });
      case TransactionsListOption.FAILURE_COUNT:
        return EventView.fromSavedQuery({
          ...baseQuery,
          query: `event.type:transaction release:${version} failure_count():>0`,
        });
      default:
        return EventView.fromSavedQuery(baseQuery);
    }
  };

  const getReleaseTrendView = (projectId: number, versionDate: string): EventView => {
    const {environments} = selection;

    const {start, end, statsPeriod} = getReleaseParams({
      location,
      releaseBounds,
    });

    const trendView = EventView.fromSavedQuery({
      id: undefined,
      version: 2,
      name: `Release ${formatVersion(version)}`,
      fields: ['transaction'],
      query: 'tpm():>0.01 trend_percentage():>0%',
      range: statsPeriod || undefined,
      environment: environments,
      projects: [projectId],
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    }) as TrendView;
    trendView.middle = versionDate;
    return trendView;
  };

  const handleTransactionsListSortChange = (value: string) => {
    const target = {
      pathname: location.pathname,
      query: {...location.query, showTransactions: value, transactionCursor: undefined},
    };
    browserHistory.push(target);
  };

  const handleDateChange = (datetime: ChangeData) => {
    const {start, end, relative, utc} = datetime;

    if (start && end) {
      const parser = utc ? moment.utc : moment;

      router.push({
        ...location,
        query: {
          ...location.query,
          pageStatsPeriod: undefined,
          pageStart: parser(start).format(),
          pageEnd: parser(end).format(),
          pageUtc: utc ?? undefined,
        },
      });
      return;
    }

    router.push({
      ...location,
      query: {
        ...location.query,
        pageStatsPeriod: relative === RELEASE_PERIOD_KEY ? undefined : relative,
        pageStart: undefined,
        pageEnd: undefined,
        pageUtc: undefined,
      },
    });
  };

  const {start, end, period, utc} = getPageDateTime();
  const hasDiscover = organization.features.includes('discover-basic');
  const hasPerformance = organization.features.includes('performance-view');
  const {environments} = selection;
  const {selectedSort, sortOptions} = getTransactionsListSort(location);
  const releaseEventView = getReleaseEventView(project.id, selectedSort);
  const titles =
    selectedSort.value === TransactionsListOption.SLOW_LCP
      ? [t('transaction'), t('failure_count()'), t('tpm()'), t('p75(lcp)')]
      : [t('transaction'), t('failure_count()'), t('tpm()'), t('p50()')];
  const releaseTrendView = getReleaseTrendView(project.id, releaseMeta.released);

  const generateLink = {
    transaction: generateTransactionLink(
      version,
      project.id,
      selection,
      // technically our query params can be an array
      (location.query.showTransactions as string | undefined) ?? ''
    ),
  };

  const defaultDateTimeSelected = !period && !start && !end;

  const releaseBoundsLabel =
    releaseBounds.type === 'clamped'
      ? t('Clamped Release Period')
      : t('Entire Release Period');

  const loading = allReleasesLoading || thisReleaseLoading;
  const reloading = allReleasesReloading || thisReleaseReloading;
  const errored = allReleasesErrored || thisReleaseErrored;

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Release %s', formatVersion(params.release))}
        orgSlug={organization.slug}
      />
      <Layout.Body>
        <Layout.Main>
          {isReleaseArchived(release) && (
            <ReleaseArchivedNotice onRestore={() => handleRestore(refetchData)} />
          )}
          <ReleaseDetailsPageFilters>
            <EnvironmentPageFilter />
            <TimeRangeSelector
              relative={period ?? (defaultDateTimeSelected ? RELEASE_PERIOD_KEY : null)}
              start={start ?? null}
              end={end ?? null}
              utc={utc ?? null}
              onChange={handleDateChange}
              menuTitle={t('Filter Time Range')}
              triggerProps={{
                children: defaultDateTimeSelected ? releaseBoundsLabel : null,
              }}
              relativeOptions={({defaultOptions, arbitraryOptions}) =>
                releaseBounds.type === 'ancient'
                  ? {...defaultOptions, ...arbitraryOptions}
                  : {
                      [RELEASE_PERIOD_KEY]: (
                        <Fragment>
                          {releaseBoundsLabel}
                          <br />
                          <ReleaseBoundsDescription primary={defaultDateTimeSelected}>
                            <DateTime date={releaseBounds.releaseStart} />
                            –<DateTime date={releaseBounds.releaseEnd} />
                          </ReleaseBoundsDescription>
                        </Fragment>
                      ),
                      ...defaultOptions,
                      ...arbitraryOptions,
                    }
              }
              defaultPeriod={
                releaseBounds.type === 'ancient' ? '90d' : RELEASE_PERIOD_KEY
              }
              defaultAbsolute={{
                start: moment(releaseBounds.releaseStart).subtract(1, 'hour').toDate(),
                end: releaseBounds.releaseEnd
                  ? moment(releaseBounds.releaseEnd).add(1, 'hour').toDate()
                  : undefined,
              }}
            />
          </ReleaseDetailsPageFilters>
          {(hasDiscover || hasPerformance || hasHealthData) && (
            <DemoTourElement
              id={DemoTourStep.RELEASES_CHART}
              title={t('Release-specific trends')}
              description={t(
                'Track key metrics like crash free session rate, failure rate and more.'
              )}
              position="top-end"
            >
              <ReleaseComparisonChart
                release={release}
                releaseSessions={thisRelease}
                allSessions={allReleases}
                platform={project.platform}
                loading={loading}
                reloading={reloading}
                errored={errored}
                project={project}
                api={api}
                hasHealthData={hasHealthData}
              />
            </DemoTourElement>
          )}
          <ReleaseIssues
            organization={organization}
            version={version}
            location={location}
            releaseBounds={releaseBounds}
            queryFilterDescription={t('In this release')}
            withChart
          />
          <Feature features="performance-view">
            <TransactionsList
              location={location}
              organization={organization}
              eventView={releaseEventView}
              trendView={releaseTrendView}
              selected={selectedSort}
              options={sortOptions}
              handleDropdownChange={handleTransactionsListSortChange}
              titles={titles}
              generateLink={generateLink}
              supportsInvestigationRule={false}
            />
          </Feature>
        </Layout.Main>
        <DemoTourElement
          id={DemoTourStep.RELEASES_STATS}
          title={t('Release stats')}
          description={t('Track release adoption, commit stats, and more.')}
          position="left-start"
        >
          <Layout.Side>
            <ReleaseStats
              organization={organization}
              release={release}
              project={project}
            />
            {hasHealthData && (
              <ReleaseAdoption
                releaseSessions={thisRelease}
                allSessions={allReleases}
                loading={loading}
                reloading={reloading}
                errored={errored}
                release={release}
                project={project}
                environment={environments}
              />
            )}
            <ProjectReleaseDetails
              release={release}
              releaseMeta={releaseMeta}
              project={project}
            />
            {commitCount > 0 && (
              <CommitAuthorBreakdown
                version={version}
                orgId={organization.slug}
                projectSlug={project.slug}
              />
            )}
            {releaseMeta.projects.length > 1 && (
              <OtherProjects
                projects={releaseMeta.projects.filter(p => p.slug !== project.slug)}
                location={location}
                version={version}
                organization={organization}
              />
            )}
            {hasHealthData && (
              <TotalCrashFreeUsers
                organization={organization}
                version={version}
                projectSlug={project.slug}
                location={location}
              />
            )}
            {deploys.length > 0 && (
              <Deploys
                version={version}
                orgSlug={organization.slug}
                deploys={deploys}
                projectId={project.id}
              />
            )}
          </Layout.Side>
        </DemoTourElement>
      </Layout.Body>
    </Fragment>
  );
}

function generateTransactionLink(
  version: string,
  projectId: number,
  selection: PageFilters,
  value: string
) {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    _location: Location
  ): LocationDescriptor => {
    const {transaction} = tableRow;
    const trendTransaction = ['regression', 'improved'].includes(value);
    const {environments, datetime} = selection;
    const {start, end, period} = datetime;

    return transactionSummaryRouteWithQuery({
      organization,
      transaction: transaction! as string,
      query: {
        query: trendTransaction ? '' : `release:${version}`,
        environment: environments,
        start: start ? getUtcDateString(start) : undefined,
        end: end ? getUtcDateString(end) : undefined,
        statsPeriod: period,
      },
      projectID: projectId.toString(),
      display: trendTransaction ? DisplayModes.TREND : DisplayModes.DURATION,
    });
  };
}

function getDropdownOptions(): DropdownOption[] {
  return [
    {
      sort: {kind: 'desc', field: 'failure_count'},
      value: TransactionsListOption.FAILURE_COUNT,
      label: t('Failing Transactions'),
    },
    {
      sort: {kind: 'desc', field: 'epm'},
      value: TransactionsListOption.TPM,
      label: t('Frequent Transactions'),
    },
    {
      sort: {kind: 'desc', field: 'p50'},
      value: TransactionsListOption.SLOW,
      label: t('Slow Transactions'),
    },
    {
      sort: {kind: 'desc', field: 'p75_measurements_lcp'},
      value: TransactionsListOption.SLOW_LCP,
      label: t('Slow LCP'),
    },
    {
      sort: {kind: 'desc', field: 'trend_percentage()'},
      query: [['confidence()', '>6']],
      trendType: TrendChangeType.REGRESSION,
      value: TransactionsListOption.REGRESSION,
      label: t('Trending Regressions'),
    },
    {
      sort: {kind: 'asc', field: 'trend_percentage()'},
      query: [['confidence()', '>6']],
      trendType: TrendChangeType.IMPROVED,
      value: TransactionsListOption.IMPROVEMENT,
      label: t('Trending Improvements'),
    },
  ];
}

function getTransactionsListSort(location: Location): {
  selectedSort: DropdownOption;
  sortOptions: DropdownOption[];
} {
  const sortOptions = getDropdownOptions();
  const urlParam = decodeScalar(
    location.query.showTransactions,
    TransactionsListOption.FAILURE_COUNT
  );
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0]!;
  return {selectedSort, sortOptions};
}

const ReleaseDetailsPageFilters = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, max-content) 1fr;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: auto;
  }
`;

const ReleaseBoundsDescription = styled('span')<{primary: boolean}>`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => (p.primary ? p.theme.activeText : p.theme.tokens.content.secondary)};
`;

export default ReleaseOverview;
