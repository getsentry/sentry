import React from 'react';
import {Location, LocationDescriptor, Query} from 'history';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import Feature from 'app/components/acl/feature';
import space from 'app/styles/space';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {Organization, GlobalSelection, ReleaseProject} from 'app/types';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {TrendView, TrendChangeType} from 'app/views/performance/trends/types';
import {formatVersion} from 'app/utils/formatters';
import routeTitleGen from 'app/utils/routeTitle';
import {Body, Main, Side} from 'app/components/layouts/thirds';
import {restoreRelease} from 'app/actionCreators/release';
import TransactionsList, {DropdownOption} from 'app/components/discover/transactionsList';
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import {transactionSummaryRouteWithQuery} from 'app/views/performance/transactionSummary/utils';
import {DisplayModes} from 'app/views/performance/transactionSummary/charts';
import {decodeScalar} from 'app/utils/queryString';

import ReleaseChart from './chart/';
import Issues from './issues';
import CommitAuthorBreakdown from './commitAuthorBreakdown';
import ProjectReleaseDetails from './projectReleaseDetails';
import OtherProjects from './otherProjects';
import TotalCrashFreeUsers from './totalCrashFreeUsers';
import Deploys from './deploys';
import ReleaseStatsRequest from './releaseStatsRequest';
import ReleaseArchivedNotice from './releaseArchivedNotice';
import {YAxis} from './chart/releaseChartControls';
import {ReleaseContext} from '..';
import {isReleaseArchived} from '../../utils';

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

    router.push({
      ...location,
      query: {...location.query, yAxis},
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

  getYAxis(hasHealthData: boolean): YAxis {
    const {yAxis} = this.props.location.query;

    if (typeof yAxis === 'string') {
      return yAxis as YAxis;
    }

    if (hasHealthData) {
      return YAxis.SESSIONS;
    }

    return YAxis.EVENTS;
  }

  getReleaseEventView(version: string, projectId: number): EventView {
    const {selection} = this.props;
    const {environments, datetime} = selection;
    const {start, end, period} = datetime;

    return EventView.fromSavedQuery({
      id: undefined,
      version: 2,
      name: `Release ${formatVersion(version)}`,
      query: `release:${version}`,
      fields: ['transaction', 'failure_rate()', 'epm()', 'p50()'],
      orderby: 'epm',
      range: period,
      environment: environments,
      projects: [projectId],
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    });
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
          const hasPerformance =
            organization.features.includes('performance-view') &&
            organization.features.includes('release-performance-views');
          const yAxis = this.getYAxis(hasHealthData);

          const releaseEventView = this.getReleaseEventView(version, project.id);
          const releaseTrendView = this.getReleaseTrendView(
            version,
            project.id,
            releaseMeta.released
          );
          const {selectedSort, sortOptions} = getTransactionListSort(location);

          return (
            <ReleaseStatsRequest
              api={api}
              orgId={organization.slug}
              projectSlug={project.slug}
              version={version}
              selection={selection}
              location={location}
              yAxis={yAxis}
              hasHealthData={hasHealthData}
              hasDiscover={hasDiscover}
              hasPerformance={hasPerformance}
            >
              {({crashFreeTimeBreakdown, ...releaseStatsProps}) => (
                <StyledBody>
                  <Main>
                    {isReleaseArchived(release) && (
                      <ReleaseArchivedNotice
                        onRestore={() => this.handleRestore(project, refetchData)}
                      />
                    )}

                    {(hasDiscover || hasPerformance || hasHealthData) && (
                      <ReleaseChart
                        {...releaseStatsProps}
                        selection={selection}
                        yAxis={yAxis}
                        onYAxisChange={this.handleYAxisChange}
                        router={router}
                        organization={organization}
                        hasHealthData={hasHealthData}
                        location={location}
                        api={api}
                        version={version}
                        hasDiscover={hasDiscover}
                        hasPerformance={hasPerformance}
                      />
                    )}
                    <Issues
                      orgId={organization.slug}
                      selection={selection}
                      version={version}
                      location={location}
                    />
                    <Feature features={['release-performance-views']}>
                      <TransactionsList
                        api={api}
                        location={location}
                        organization={organization}
                        eventView={releaseEventView}
                        trendView={releaseTrendView}
                        dropdownTitle={t('Show')}
                        selected={selectedSort}
                        options={sortOptions}
                        handleDropdownChange={this.handleTransactionsListSortChange}
                        titles={[
                          t('transaction'),
                          t('failure_rate()'),
                          t('tpm()'),
                          t('p50()'),
                        ]}
                        generateFirstLink={generateTransactionLinkFn(
                          version,
                          project.id,
                          selection,
                          location.query.showTransactions
                        )}
                      />
                    </Feature>
                  </Main>
                  <Side>
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
                </StyledBody>
              )}
            </ReleaseStatsRequest>
          );
        }}
      </ReleaseContext.Consumer>
    );
  }
}

function generateTransactionLinkFn(
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
      sort: {kind: 'asc', field: 'transaction'},
      value: 'name',
      label: t('Transactions'),
    },
    {
      sort: {kind: 'desc', field: 'failure_rate'},
      value: 'failure_rate',
      label: t('Failing Transactions'),
    },
    {
      sort: {kind: 'desc', field: 'epm'},
      value: 'tpm',
      label: t('Frequent Transactions'),
    },
    {
      sort: {kind: 'desc', field: 'p50'},
      value: 'p50',
      label: t('Slow Transactions'),
    },
    {
      sort: {kind: 'desc', field: 'trend_percentage()'},
      query: 'tpm():>0.01 trend_percentage():>0% t_test():<-6',
      trendType: TrendChangeType.REGRESSION,
      value: 'regression',
      label: t('Trending Regressions'),
    },
    {
      sort: {kind: 'asc', field: 'trend_percentage()'},
      query: 'tpm():>0.01 trend_percentage():>0% t_test():>6',
      trendType: TrendChangeType.IMPROVED,
      value: 'improved',
      label: t('Trending Improvements'),
    },
  ];
}

function getTransactionListSort(
  location: Location
): {selectedSort: DropdownOption; sortOptions: DropdownOption[]} {
  const sortOptions = getDropdownOptions();
  const urlParam = decodeScalar(location.query.showTransactions) || 'tpm';
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0];
  return {selectedSort, sortOptions};
}

export default withApi(withGlobalSelection(withOrganization(ReleaseOverview)));

const StyledBody = styled(Body)`
  margin: -${space(2)} -${space(4)};
`;
