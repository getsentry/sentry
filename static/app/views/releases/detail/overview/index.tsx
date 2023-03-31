import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';
import moment from 'moment';

import {restoreRelease} from 'sentry/actionCreators/release';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import SessionsRequest from 'sentry/components/charts/sessionsRequest';
import {DateTimeObject} from 'sentry/components/charts/utils';
import DateTime from 'sentry/components/dateTime';
import PerformanceCardTable from 'sentry/components/discover/performanceCardTable';
import TransactionsList, {
  DropdownOption,
} from 'sentry/components/discover/transactionsList';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ChangeData} from 'sentry/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  NewQuery,
  Organization,
  PageFilters,
  ReleaseProject,
  SessionFieldWithOperation,
} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {MobileVital, SpanOpBreakdown, WebVital} from 'sentry/utils/fields';
import {formatVersion} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import AsyncView from 'sentry/views/asyncView';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';
import {TrendChangeType, TrendView} from 'sentry/views/performance/trends/types';
import {
  platformToPerformanceType,
  PROJECT_PERFORMANCE_TYPE,
} from 'sentry/views/performance/utils';

import {
  getReleaseParams,
  isReleaseArchived,
  ReleaseBounds,
  searchReleaseVersion,
} from '../../utils';
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

type Props = RouteComponentProps<RouteParams, {}> & {
  api: Client;
  organization: Organization;
  selection: PageFilters;
};

class ReleaseOverview extends AsyncView<Props> {
  getTitle() {
    const {params, organization} = this.props;
    return routeTitleGen(
      t('Release %s', formatVersion(params.release)),
      organization.slug,
      false
    );
  }

  handleRestore = async (project: ReleaseProject, successCallback: () => void) => {
    const {params, organization} = this.props;

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

  getReleaseEventView(
    version: string,
    projectId: number,
    selectedSort: DropdownOption,
    releaseBounds: ReleaseBounds
  ): EventView {
    const {selection, location} = this.props;
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
  }

  getReleaseTrendView(
    version: string,
    projectId: number,
    versionDate: string,
    releaseBounds: ReleaseBounds
  ): EventView {
    const {selection, location} = this.props;
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
  }

  getReleasePerformanceEventView(
    performanceType: string,
    baseQuery: NewQuery
  ): EventView {
    const eventView =
      performanceType === PROJECT_PERFORMANCE_TYPE.FRONTEND
        ? (EventView.fromSavedQuery({
            ...baseQuery,
            fields: [
              ...baseQuery.fields,
              `p75(${WebVital.FCP})`,
              `p75(${WebVital.FID})`,
              `p75(${WebVital.LCP})`,
              `p75(${WebVital.CLS})`,
              `p75(${SpanOpBreakdown.SpansHttp})`,
              `p75(${SpanOpBreakdown.SpansBrowser})`,
              `p75(${SpanOpBreakdown.SpansResource})`,
            ],
          }) as EventView)
        : performanceType === PROJECT_PERFORMANCE_TYPE.BACKEND
        ? (EventView.fromSavedQuery({
            ...baseQuery,
            fields: [...baseQuery.fields, 'apdex()', 'p75(spans.http)', 'p75(spans.db)'],
          }) as EventView)
        : performanceType === PROJECT_PERFORMANCE_TYPE.MOBILE
        ? (EventView.fromSavedQuery({
            ...baseQuery,
            fields: [
              ...baseQuery.fields,
              `p75(${MobileVital.AppStartCold})`,
              `p75(${MobileVital.AppStartWarm})`,
              `p75(${MobileVital.FramesSlow})`,
              `p75(${MobileVital.FramesFrozen})`,
            ],
          }) as EventView)
        : (EventView.fromSavedQuery({
            ...baseQuery,
          }) as EventView);

    return eventView;
  }

  getAllReleasesPerformanceView(
    projectId: number,
    performanceType: string,
    releaseBounds: ReleaseBounds
  ) {
    const {selection, location} = this.props;
    const {environments} = selection;

    const {start, end, statsPeriod} = getReleaseParams({
      location,
      releaseBounds,
    });

    const baseQuery: NewQuery = {
      id: undefined,
      version: 2,
      name: 'All Releases',
      query: 'event.type:transaction',
      fields: ['user_misery()'],
      range: statsPeriod || undefined,
      environment: environments,
      projects: [projectId],
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    };

    return this.getReleasePerformanceEventView(performanceType, baseQuery);
  }

  getReleasePerformanceView(
    version: string,
    projectId: number,
    performanceType: string,
    releaseBounds: ReleaseBounds
  ) {
    const {selection, location} = this.props;
    const {environments} = selection;

    const {start, end, statsPeriod} = getReleaseParams({
      location,
      releaseBounds,
    });

    const baseQuery: NewQuery = {
      id: undefined,
      version: 2,
      name: `Release:${version}`,
      query: `event.type:transaction release:${version}`,
      fields: ['user_misery()'],
      range: statsPeriod || undefined,
      environment: environments,
      projects: [projectId],
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    };

    return this.getReleasePerformanceEventView(performanceType, baseQuery);
  }

  get pageDateTime(): DateTimeObject {
    const query = this.props.location.query;

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
  }

  handleTransactionsListSortChange = (value: string) => {
    const {location} = this.props;

    const target = {
      pathname: location.pathname,
      query: {...location.query, showTransactions: value, transactionCursor: undefined},
    };
    browserHistory.push(target);
  };

  handleDateChange = (datetime: ChangeData) => {
    const {router, location} = this.props;
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

  render() {
    const {organization, selection, location, api} = this.props;
    const {start, end, period, utc} = this.pageDateTime;

    return (
      <ReleaseContext.Consumer>
        {({
          release,
          project,
          deploys,
          releaseMeta,
          refetchData,
          hasHealthData,
          releaseBounds,
        }) => {
          const {commitCount, version} = release;
          const hasDiscover = organization.features.includes('discover-basic');
          const hasPerformance = organization.features.includes('performance-view');
          const hasReleaseComparisonPerformance = organization.features.includes(
            'release-comparison-performance'
          );
          const {environments} = selection;
          const performanceType = platformToPerformanceType([project], [project.id]);
          const {selectedSort, sortOptions} = getTransactionsListSort(location);
          const releaseEventView = this.getReleaseEventView(
            version,
            project.id,
            selectedSort,
            releaseBounds
          );
          const titles =
            selectedSort.value !== TransactionsListOption.SLOW_LCP
              ? [t('transaction'), t('failure_count()'), t('tpm()'), t('p50()')]
              : [t('transaction'), t('failure_count()'), t('tpm()'), t('p75(lcp)')];
          const releaseTrendView = this.getReleaseTrendView(
            version,
            project.id,
            releaseMeta.released,
            releaseBounds
          );
          const allReleasesPerformanceView = this.getAllReleasesPerformanceView(
            project.id,
            performanceType,
            releaseBounds
          );
          const releasePerformanceView = this.getReleasePerformanceView(
            version,
            project.id,
            performanceType,
            releaseBounds
          );

          const generateLink = {
            transaction: generateTransactionLink(
              version,
              project.id,
              selection,
              location.query.showTransactions
            ),
          };

          const sessionsRequestProps: Omit<SessionsRequest['props'], 'children'> = {
            api,
            organization,
            field: [
              SessionFieldWithOperation.USERS,
              SessionFieldWithOperation.SESSIONS,
              SessionFieldWithOperation.DURATION,
            ],
            groupBy: ['session.status'],
            ...getReleaseParams({location, releaseBounds}),
            shouldFilterSessionsInTimeWindow: true,
          };

          return (
            <SessionsRequest {...sessionsRequestProps}>
              {({
                loading: allReleasesLoading,
                reloading: allReleasesReloading,
                errored: allReleasesErrored,
                response: allReleases,
              }) => (
                <SessionsRequest
                  {...sessionsRequestProps}
                  query={searchReleaseVersion(version)}
                >
                  {({
                    loading: thisReleaseLoading,
                    reloading: thisReleaseReloading,
                    errored: thisReleaseErrored,
                    response: thisRelease,
                  }) => {
                    const loading = allReleasesLoading || thisReleaseLoading;
                    const reloading = allReleasesReloading || thisReleaseReloading;
                    const errored = allReleasesErrored || thisReleaseErrored;
                    return (
                      <Layout.Body>
                        <Layout.Main>
                          {isReleaseArchived(release) && (
                            <ReleaseArchivedNotice
                              onRestore={() => this.handleRestore(project, refetchData)}
                            />
                          )}
                          <ReleaseDetailsPageFilters>
                            <EnvironmentPageFilter />
                            <PageTimeRangeSelector
                              organization={organization}
                              relative={period ?? ''}
                              start={start ?? null}
                              end={end ?? null}
                              utc={utc ?? null}
                              onUpdate={this.handleDateChange}
                              relativeOptions={
                                releaseBounds.type !== 'ancient'
                                  ? {
                                      [RELEASE_PERIOD_KEY]: (
                                        <Fragment>
                                          {releaseBounds.type === 'clamped'
                                            ? t('Clamped Release Period')
                                            : t('Entire Release Period')}{' '}
                                          (
                                          <DateTime
                                            date={releaseBounds.releaseStart}
                                          /> -{' '}
                                          <DateTime date={releaseBounds.releaseEnd} />)
                                        </Fragment>
                                      ),
                                      ...DEFAULT_RELATIVE_PERIODS,
                                    }
                                  : DEFAULT_RELATIVE_PERIODS
                              }
                              defaultPeriod={
                                releaseBounds.type !== 'ancient'
                                  ? RELEASE_PERIOD_KEY
                                  : '90d'
                              }
                              defaultAbsolute={{
                                start: moment(releaseBounds.releaseStart)
                                  .subtract(1, 'hour')
                                  .toDate(),
                                end: releaseBounds.releaseEnd
                                  ? moment(releaseBounds.releaseEnd)
                                      .add(1, 'hour')
                                      .toDate()
                                  : undefined,
                              }}
                            />
                          </ReleaseDetailsPageFilters>

                          {(hasDiscover || hasPerformance || hasHealthData) && (
                            <ReleaseComparisonChart
                              release={release}
                              releaseSessions={thisRelease}
                              allSessions={allReleases}
                              platform={project.platform}
                              location={location}
                              loading={loading}
                              reloading={reloading}
                              errored={errored}
                              project={project}
                              organization={organization}
                              api={api}
                              hasHealthData={hasHealthData}
                            />
                          )}

                          <ReleaseIssues
                            organization={organization}
                            selection={selection}
                            version={version}
                            location={location}
                            releaseBounds={releaseBounds}
                            queryFilterDescription={t('In this release')}
                            withChart
                          />

                          <Feature features={['performance-view']}>
                            {hasReleaseComparisonPerformance ? (
                              <PerformanceCardTable
                                organization={organization}
                                project={project}
                                location={location}
                                allReleasesEventView={allReleasesPerformanceView}
                                releaseEventView={releasePerformanceView}
                                performanceType={performanceType}
                              />
                            ) : (
                              <TransactionsList
                                location={location}
                                organization={organization}
                                eventView={releaseEventView}
                                trendView={releaseTrendView}
                                selected={selectedSort}
                                options={sortOptions}
                                handleDropdownChange={
                                  this.handleTransactionsListSortChange
                                }
                                titles={titles}
                                generateLink={generateLink}
                              />
                            )}
                          </Feature>
                        </Layout.Main>
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
                            orgSlug={organization.slug}
                            projectSlug={project.slug}
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
                              projects={releaseMeta.projects.filter(
                                p => p.slug !== project.slug
                              )}
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
                      </Layout.Body>
                    );
                  }}
                </SessionsRequest>
              )}
            </SessionsRequest>
          );
        }}
      </ReleaseContext.Consumer>
    );
  }
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
    _query: Query
  ): LocationDescriptor => {
    const {transaction} = tableRow;
    const trendTransaction = ['regression', 'improved'].includes(value);
    const {environments, datetime} = selection;
    const {start, end, period} = datetime;

    return transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
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
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0];
  return {selectedSort, sortOptions};
}

const ReleaseDetailsPageFilters = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, max-content) 1fr;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto;
  }
`;

export default withApi(withPageFilters(withOrganization(ReleaseOverview)));
