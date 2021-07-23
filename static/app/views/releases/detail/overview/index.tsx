import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';
import moment from 'moment';

import {restoreRelease} from 'app/actionCreators/release';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import {DateTimeObject} from 'app/components/charts/utils';
import DateTime from 'app/components/dateTime';
import TransactionsList, {DropdownOption} from 'app/components/discover/transactionsList';
import {Body, Main, Side} from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {ChangeData} from 'app/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'app/components/organizations/timeRangeSelector/pageTimeRangeSelector';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, NewQuery, Organization, ReleaseProject} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getUtcDateString} from 'app/utils/dates';
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import {formatVersion} from 'app/utils/formatters';
import {decodeScalar} from 'app/utils/queryString';
import routeTitleGen from 'app/utils/routeTitle';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import {DisplayModes} from 'app/views/performance/transactionSummary/charts';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';
import {TrendChangeType, TrendView} from 'app/views/performance/trends/types';

import {getReleaseParams, isReleaseArchived, ReleaseBounds} from '../../utils';
import {ReleaseContext} from '..';

import ReleaseChart from './chart/';
import {EventType, YAxis} from './chart/releaseChartControls';
import CommitAuthorBreakdown from './commitAuthorBreakdown';
import Deploys from './deploys';
import Issues from './issues';
import OtherProjects from './otherProjects';
import ProjectReleaseDetails from './projectReleaseDetails';
import ReleaseAdoption from './releaseAdoption';
import ReleaseArchivedNotice from './releaseArchivedNotice';
import ReleaseComparisonChart from './releaseComparisonChart';
import ReleaseDetailsRequest from './releaseDetailsRequest';
import ReleaseStats from './releaseStats';
import TotalCrashFreeUsers from './totalCrashFreeUsers';

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
  organization: Organization;
  selection: GlobalSelection;
  api: Client;
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

  handleYAxisChange = (yAxis: YAxis, project: ReleaseProject) => {
    const {location, router, organization} = this.props;
    const {eventType, vitalType, ...query} = location.query;

    trackAnalyticsEvent({
      eventKey: `release_detail.change_chart`,
      eventName: `Release Detail: Change Chart`,
      organization_id: parseInt(organization.id, 10),
      display: yAxis,
      eventType,
      vitalType,
      platform: project.platform,
    });

    router.push({
      ...location,
      query: {...query, yAxis},
    });
  };

  handleEventTypeChange = (eventType: EventType, project: ReleaseProject) => {
    const {location, router, organization} = this.props;

    trackAnalyticsEvent({
      eventKey: `release_detail.change_chart`,
      eventName: `Release Detail: Change Chart`,
      organization_id: parseInt(organization.id, 10),
      display: YAxis.EVENTS,
      eventType,
      platform: project.platform,
    });

    router.push({
      ...location,
      query: {...location.query, eventType},
    });
  };

  handleVitalTypeChange = (vitalType: WebVital, project: ReleaseProject) => {
    const {location, router, organization} = this.props;

    trackAnalyticsEvent({
      eventKey: `release_detail.change_chart`,
      eventName: `Release Detail: Change Chart`,
      organization_id: parseInt(organization.id, 10),
      display: YAxis.COUNT_VITAL,
      vitalType,
      platform: project.platform,
    });

    router.push({
      ...location,
      query: {...location.query, vitalType},
    });
  };

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

  getYAxis(hasHealthData: boolean, hasPerformance: boolean): YAxis {
    const {yAxis} = this.props.location.query;

    if (typeof yAxis === 'string') {
      if (Object.values(YAxis).includes(yAxis as YAxis)) {
        return yAxis as YAxis;
      }
    }

    if (hasHealthData) {
      return YAxis.SESSIONS;
    }

    if (hasPerformance) {
      return YAxis.FAILED_TRANSACTIONS;
    }

    return YAxis.EVENTS;
  }

  getEventType(yAxis: YAxis): EventType {
    if (yAxis === YAxis.EVENTS) {
      const {eventType} = this.props.location.query;

      if (typeof eventType === 'string') {
        if (Object.values(EventType).includes(eventType as EventType)) {
          return eventType as EventType;
        }
      }
    }

    return EventType.ALL;
  }

  getVitalType(yAxis: YAxis): WebVital {
    if (yAxis === YAxis.COUNT_VITAL) {
      const {vitalType} = this.props.location.query;

      if (typeof vitalType === 'string') {
        if (Object.values(WebVital).includes(vitalType as WebVital)) {
          return vitalType as WebVital;
        }
      }
    }

    return WebVital.LCP;
  }

  getReleaseEventView(
    version: string,
    projectId: number,
    selectedSort: DropdownOption,
    releaseBounds: ReleaseBounds,
    defaultStatsPeriod: string
  ): EventView {
    const {selection, location, organization} = this.props;
    const {environments} = selection;

    const {start, end, statsPeriod} = getReleaseParams({
      location,
      releaseBounds,
      defaultStatsPeriod,
      allowEmptyPeriod: organization.features.includes('release-comparison'),
    });

    const baseQuery: NewQuery = {
      id: undefined,
      version: 2,
      name: `Release ${formatVersion(version)}`,
      query: `event.type:transaction release:${version}`,
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
    releaseBounds: ReleaseBounds,
    defaultStatsPeriod: string
  ): EventView {
    const {selection, location, organization} = this.props;
    const {environments} = selection;

    const {start, end, statsPeriod} = getReleaseParams({
      location,
      releaseBounds,
      defaultStatsPeriod,
      allowEmptyPeriod: organization.features.includes('release-comparison'),
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

  get pageDateTime(): DateTimeObject {
    const query = this.props.location.query;

    const {start, end, statsPeriod} = getParams(query, {
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
    const {organization, selection, location, api, router} = this.props;
    const {start, end, period, utc} = this.pageDateTime;

    return (
      <ReleaseContext.Consumer>
        {({
          release,
          project,
          deploys,
          releaseMeta,
          refetchData,
          defaultStatsPeriod,
          isHealthLoading,
          getHealthData,
          hasHealthData,
          releaseBounds,
        }) => {
          const {commitCount, version} = release;
          const hasDiscover = organization.features.includes('discover-basic');
          const hasPerformance = organization.features.includes('performance-view');
          const yAxis = this.getYAxis(hasHealthData, hasPerformance);
          const eventType = this.getEventType(yAxis);
          const vitalType = this.getVitalType(yAxis);

          const {selectedSort, sortOptions} = getTransactionsListSort(location);
          const releaseEventView = this.getReleaseEventView(
            version,
            project.id,
            selectedSort,
            releaseBounds,
            defaultStatsPeriod
          );
          const titles =
            selectedSort.value !== TransactionsListOption.SLOW_LCP
              ? [t('transaction'), t('failure_count()'), t('tpm()'), t('p50()')]
              : [t('transaction'), t('failure_count()'), t('tpm()'), t('p75(lcp)')];
          const releaseTrendView = this.getReleaseTrendView(
            version,
            project.id,
            releaseMeta.released,
            releaseBounds,
            defaultStatsPeriod
          );

          const generateLink = {
            transaction: generateTransactionLink(
              version,
              project.id,
              selection,
              location.query.showTransactions
            ),
          };

          return (
            <ReleaseDetailsRequest
              organization={organization}
              location={location}
              disable={!organization.features.includes('release-comparison')}
              version={version}
              releaseBounds={releaseBounds}
            >
              {({thisRelease, allReleases, loading, reloading, errored}) => (
                <Body>
                  <Main>
                    {isReleaseArchived(release) && (
                      <ReleaseArchivedNotice
                        onRestore={() => this.handleRestore(project, refetchData)}
                      />
                    )}
                    <Feature features={['release-comparison']}>
                      {({hasFeature}) =>
                        hasFeature ? (
                          <Fragment>
                            <StyledPageTimeRangeSelector
                              organization={organization}
                              relative={period ?? ''}
                              start={start ?? null}
                              end={end ?? null}
                              utc={utc ?? null}
                              onUpdate={this.handleDateChange}
                              relativeOptions={{
                                [RELEASE_PERIOD_KEY]: (
                                  <Fragment>
                                    {t('Entire Release Period')} (
                                    <DateTime
                                      date={releaseBounds.releaseStart}
                                      timeAndDate
                                    />{' '}
                                    -{' '}
                                    <DateTime
                                      date={releaseBounds.releaseEnd}
                                      timeAndDate
                                    />
                                    )
                                  </Fragment>
                                ),
                                ...DEFAULT_RELATIVE_PERIODS,
                              }}
                              defaultPeriod={RELEASE_PERIOD_KEY}
                            />
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
                          </Fragment>
                        ) : (
                          (hasDiscover || hasPerformance || hasHealthData) && (
                            <ReleaseChart
                              releaseMeta={releaseMeta}
                              selection={selection}
                              yAxis={yAxis}
                              onYAxisChange={display =>
                                this.handleYAxisChange(display, project)
                              }
                              eventType={eventType}
                              onEventTypeChange={type =>
                                this.handleEventTypeChange(type, project)
                              }
                              vitalType={vitalType}
                              onVitalTypeChange={type =>
                                this.handleVitalTypeChange(type, project)
                              }
                              router={router}
                              organization={organization}
                              hasHealthData={hasHealthData}
                              location={location}
                              api={api}
                              version={version}
                              hasDiscover={hasDiscover}
                              hasPerformance={hasPerformance}
                              platform={project.platform}
                              defaultStatsPeriod={defaultStatsPeriod}
                              projectSlug={project.slug}
                            />
                          )
                        )
                      }
                    </Feature>

                    <Issues
                      organization={organization}
                      selection={selection}
                      version={version}
                      location={location}
                      defaultStatsPeriod={defaultStatsPeriod}
                      releaseBounds={releaseBounds}
                      queryFilterDescription={t('In this release')}
                      withChart
                    />
                    <Feature features={['performance-view']}>
                      <TransactionsList
                        location={location}
                        organization={organization}
                        eventView={releaseEventView}
                        trendView={releaseTrendView}
                        selected={selectedSort}
                        options={sortOptions}
                        handleDropdownChange={this.handleTransactionsListSortChange}
                        titles={titles}
                        generateLink={generateLink}
                      />
                    </Feature>
                  </Main>
                  <Side>
                    <ReleaseStats
                      organization={organization}
                      release={release}
                      project={project}
                      location={location}
                      selection={selection}
                      hasHealthData={hasHealthData}
                      getHealthData={getHealthData}
                      isHealthLoading={isHealthLoading}
                    />
                    <Feature features={['release-comparison']}>
                      {hasHealthData && (
                        <ReleaseAdoption
                          releaseSessions={thisRelease}
                          allSessions={allReleases}
                          loading={loading}
                          reloading={reloading}
                          errored={errored}
                          release={release}
                          project={project}
                        />
                      )}
                    </Feature>
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
                  </Side>
                </Body>
              )}
            </ReleaseDetailsRequest>
          );
        }}
      </ReleaseContext.Consumer>
    );
  }
}

function generateTransactionLink(
  version: string,
  projectId: number,
  selection: GlobalSelection,
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
      query: [['t_test()', '<-6']],
      trendType: TrendChangeType.REGRESSION,
      value: TransactionsListOption.REGRESSION,
      label: t('Trending Regressions'),
    },
    {
      sort: {kind: 'asc', field: 'trend_percentage()'},
      query: [['t_test()', '>6']],
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

const StyledPageTimeRangeSelector = styled(PageTimeRangeSelector)`
  margin-bottom: ${space(1.5)};
`;

export default withApi(withGlobalSelection(withOrganization(ReleaseOverview)));
