import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import {Location, LocationDescriptor, Query} from 'history';

import {restoreRelease} from 'app/actionCreators/release';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import TransactionsList, {DropdownOption} from 'app/components/discover/transactionsList';
import {Body, Main, Side} from 'app/components/layouts/thirds';
import {t} from 'app/locale';
import {GlobalSelection, NewQuery, Organization, ReleaseProject} from 'app/types';
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

import {isReleaseArchived} from '../../utils';
import {ReleaseContext} from '..';

import ReleaseChart from './chart/';
import {EventType, YAxis} from './chart/releaseChartControls';
import CommitAuthorBreakdown from './commitAuthorBreakdown';
import Deploys from './deploys';
import Issues from './issues';
import OtherProjects from './otherProjects';
import ProjectReleaseDetails from './projectReleaseDetails';
import ReleaseArchivedNotice from './releaseArchivedNotice';
import ReleaseStats from './releaseStats';
import ReleaseStatsRequest from './releaseStatsRequest';
import TotalCrashFreeUsers from './totalCrashFreeUsers';

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

  handleYAxisChange = (yAxis: YAxis) => {
    const {location, router} = this.props;
    const {eventType: _eventType, vitalType: _vitalType, ...query} = location.query;

    router.push({
      ...location,
      query: {...query, yAxis},
    });
  };

  handleEventTypeChange = (eventType: EventType) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, eventType},
    });
  };

  handleVitalTypeChange = (vitalType: WebVital) => {
    const {location, router} = this.props;

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
    selectedSort: DropdownOption
  ): EventView {
    const {selection} = this.props;
    const {environments, datetime} = selection;
    const {start, end, period} = datetime;

    const baseQuery: NewQuery = {
      id: undefined,
      version: 2,
      name: `Release ${formatVersion(version)}`,
      query: `event.type:transaction release:${version}`,
      fields: ['transaction', 'failure_count()', 'epm()', 'p50()'],
      orderby: '-failure_count',
      range: period,
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
    versionDate: string
  ): EventView {
    const {selection} = this.props;
    const {environments, datetime} = selection;
    const {start, end, period} = datetime;

    const trendView = EventView.fromSavedQuery({
      id: undefined,
      version: 2,
      name: `Release ${formatVersion(version)}`,
      fields: ['transaction'],
      query: 'tpm():>0.01 trend_percentage():>0%',
      range: period,
      environment: environments,
      projects: [projectId],
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    }) as TrendView;
    trendView.middle = versionDate;
    return trendView;
  }

  handleTransactionsListSortChange = (value: string) => {
    const {location} = this.props;
    const target = {
      pathname: location.pathname,
      query: {...location.query, showTransactions: value, transactionCursor: undefined},
    };
    browserHistory.push(target);
  };

  render() {
    const {organization, selection, location, api, router} = this.props;

    return (
      <ReleaseContext.Consumer>
        {({release, project, deploys, releaseMeta, refetchData}) => {
          const {commitCount, version} = release;
          const {hasHealthData} = project.healthData || {};
          const hasDiscover = organization.features.includes('discover-basic');
          const hasPerformance = organization.features.includes('performance-view');
          const yAxis = this.getYAxis(hasHealthData, hasPerformance);
          const eventType = this.getEventType(yAxis);
          const vitalType = this.getVitalType(yAxis);

          const {selectedSort, sortOptions} = getTransactionsListSort(location);
          const releaseEventView = this.getReleaseEventView(
            version,
            project.id,
            selectedSort
          );
          const titles =
            selectedSort.value !== TransactionsListOption.SLOW_LCP
              ? [t('transaction'), t('failure_count()'), t('tpm()'), t('p50()')]
              : [t('transaction'), t('failure_count()'), t('tpm()'), t('p75(lcp)')];
          const releaseTrendView = this.getReleaseTrendView(
            version,
            project.id,
            releaseMeta.released
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
            <ReleaseStatsRequest
              api={api}
              organization={organization}
              projectSlug={project.slug}
              version={version}
              selection={selection}
              location={location}
              yAxis={yAxis}
              eventType={eventType}
              vitalType={vitalType}
              hasHealthData={hasHealthData}
              hasDiscover={hasDiscover}
              hasPerformance={hasPerformance}
            >
              {({crashFreeTimeBreakdown, ...releaseStatsProps}) => (
                <Body>
                  <Main>
                    {isReleaseArchived(release) && (
                      <ReleaseArchivedNotice
                        onRestore={() => this.handleRestore(project, refetchData)}
                      />
                    )}

                    {(hasDiscover || hasPerformance || hasHealthData) && (
                      <ReleaseChart
                        {...releaseStatsProps}
                        releaseMeta={releaseMeta}
                        selection={selection}
                        yAxis={yAxis}
                        onYAxisChange={this.handleYAxisChange}
                        eventType={eventType}
                        onEventTypeChange={this.handleEventTypeChange}
                        vitalType={vitalType}
                        onVitalTypeChange={this.handleVitalTypeChange}
                        router={router}
                        organization={organization}
                        hasHealthData={hasHealthData}
                        location={location}
                        api={api}
                        version={version}
                        hasDiscover={hasDiscover}
                        hasPerformance={hasPerformance}
                        platform={project.platform}
                      />
                    )}
                    <Issues
                      orgId={organization.slug}
                      selection={selection}
                      version={version}
                      location={location}
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
                    />
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
                      />
                    )}
                    {hasHealthData && (
                      <TotalCrashFreeUsers
                        crashFreeTimeBreakdown={crashFreeTimeBreakdown}
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
            </ReleaseStatsRequest>
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

function getTransactionsListSort(
  location: Location
): {selectedSort: DropdownOption; sortOptions: DropdownOption[]} {
  const sortOptions = getDropdownOptions();
  const urlParam =
    decodeScalar(location.query.showTransactions) || TransactionsListOption.FAILURE_COUNT;
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0];
  return {selectedSort, sortOptions};
}

export default withApi(withGlobalSelection(withOrganization(ReleaseOverview)));
