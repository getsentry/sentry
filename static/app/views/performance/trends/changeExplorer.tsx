import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {Button} from 'sentry/components/button';
import {getArbitraryRelativePeriod} from 'sentry/components/timeRangeSelector/utils';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {IconFire, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import theme from 'sentry/utils/theme';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';
import {FunctionsList} from 'sentry/views/performance/trends/changeExplorerUtils/functionsList';
import {MetricsTable} from 'sentry/views/performance/trends/changeExplorerUtils/metricsTable';
import {SpansList} from 'sentry/views/performance/trends/changeExplorerUtils/spansList';
import {Chart} from 'sentry/views/performance/trends/chart';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendParameter,
  TrendsStats,
  TrendView,
} from 'sentry/views/performance/trends/types';
import {getTrendProjectId} from 'sentry/views/performance/trends/utils';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

type PerformanceChangeExplorerProps = {
  collapsed: boolean;
  isLoading: boolean;
  location: Location;
  onClose: () => void;
  organization: Organization;
  projects: Project[];
  statsData: TrendsStats;
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
  trendFunction: string;
  trendParameter: TrendParameter;
  trendView: TrendView;
};

type ExplorerBodyProps = {
  isLoading: boolean;
  location: Location;
  organization: Organization;
  projects: Project[];
  statsData: TrendsStats;
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
  trendFunction: string;
  trendParameter: TrendParameter;
  trendView: TrendView;
};

type HeaderProps = {
  organization: Organization;
  projects: Project[];
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
  trendFunction: string;
  trendParameter: TrendParameter;
  trendView: TrendView;
};

export function PerformanceChangeExplorer({
  collapsed,
  transaction,
  onClose,
  trendChangeType,
  trendFunction,
  trendView,
  statsData,
  isLoading,
  organization,
  projects,
  trendParameter,
  location,
}: PerformanceChangeExplorerProps) {
  return (
    <DetailPanel detailKey={!collapsed ? transaction.transaction : ''} onClose={onClose}>
      {!collapsed && (
        <PanelBodyWrapper>
          <ExplorerBody
            transaction={transaction}
            trendChangeType={trendChangeType}
            trendFunction={trendFunction}
            trendView={trendView}
            statsData={statsData}
            isLoading={isLoading}
            organization={organization}
            projects={projects}
            trendParameter={trendParameter}
            location={location}
          />
        </PanelBodyWrapper>
      )}
    </DetailPanel>
  );
}

function ExplorerBody(props: ExplorerBodyProps) {
  const {
    transaction,
    trendChangeType,
    trendFunction,
    trendView,
    trendParameter,
    isLoading,
    location,
    organization,
    projects,
  } = props;
  const breakpointDate = transaction.breakpoint
    ? moment(transaction.breakpoint * 1000).format('ddd, DD MMM YYYY HH:mm:ss z')
    : '';

  const start = moment(trendView.start).format('DD MMM YYYY HH:mm:ss z');
  const end = moment(trendView.end).format('DD MMM YYYY HH:mm:ss z');
  return (
    <Fragment>
      <Header
        transaction={transaction}
        trendChangeType={trendChangeType}
        trendView={trendView}
        projects={projects}
        organization={organization}
        trendFunction={trendFunction}
        trendParameter={trendParameter}
      />
      <div style={{display: 'flex', gap: space(4)}}>
        <InfoItem
          label={
            trendChangeType === TrendChangeType.REGRESSION
              ? t('Regression Metric')
              : t('Improvement Metric')
          }
          value={trendFunction}
        />
        <InfoItem label={t('Start Time')} value={breakpointDate} />
      </div>
      <GraphPanel data-test-id="pce-graph">
        <strong>{`${trendParameter.label} (${trendFunction})`}</strong>
        <ExplorerText color={theme.gray300} margin={`-${space(3)}`}>
          {trendView.statsPeriod
            ? DEFAULT_RELATIVE_PERIODS[trendView.statsPeriod] ||
              getArbitraryRelativePeriod(trendView.statsPeriod)[trendView.statsPeriod]
            : `${start} - ${end}`}
        </ExplorerText>
        <Chart
          query={trendView.query}
          project={trendView.project}
          environment={trendView.environment}
          start={trendView.start}
          end={trendView.end}
          statsPeriod={trendView.statsPeriod}
          disableXAxis
          disableLegend
          neutralColor
          {...props}
        />
      </GraphPanel>
      <MetricsTable
        isLoading={isLoading}
        location={location}
        transaction={transaction}
        trendFunction={trendFunction}
        trendView={trendView}
        organization={organization}
      />
      <SpansList
        location={location}
        organization={organization}
        trendView={trendView}
        transaction={transaction}
        breakpoint={transaction.breakpoint!}
        trendChangeType={trendChangeType}
      />
      <FunctionsList
        location={location}
        organization={organization}
        trendView={trendView}
        transaction={transaction}
        breakpoint={transaction.breakpoint!}
        trendChangeType={trendChangeType}
      />
    </Fragment>
  );
}

function InfoItem({label, value}: {label: string; value: string}) {
  return (
    <div>
      <InfoLabel>{label}</InfoLabel>
      <InfoText>{value}</InfoText>
    </div>
  );
}

function Header(props: HeaderProps) {
  const {
    transaction,
    trendChangeType,
    trendView,
    projects,
    organization,
    trendFunction,
    trendParameter,
  } = props;

  const regression = trendChangeType === TrendChangeType.REGRESSION;
  const transactionSummaryLink = getTransactionSummaryLink(
    trendView,
    transaction,
    projects,
    organization,
    trendFunction,
    trendParameter
  );

  const handleClickAnalytics = () => {
    trackAnalytics('performance_views.performance_change_explorer.summary_link_clicked', {
      organization,
      transaction: transaction.transaction,
    });
  };

  return (
    <HeaderWrapper data-test-id="pce-header">
      <FireIcon regression={regression}>
        <IconFire color="white" />
      </FireIcon>
      <HeaderTextWrapper>
        <ChangeType regression={regression}>
          {regression ? t('Ongoing Regression') : t('Ongoing Improvement')}
        </ChangeType>
        <TransactionNameWrapper>
          <TransactionName>{transaction.transaction}</TransactionName>
          <ViewTransactionButton
            borderless
            to={normalizeUrl(transactionSummaryLink)}
            icon={<IconOpen />}
            aria-label={t('View transaction summary')}
            onClick={handleClickAnalytics}
          />
        </TransactionNameWrapper>
      </HeaderTextWrapper>
    </HeaderWrapper>
  );
}

function getTransactionSummaryLink(
  eventView: TrendView,
  transaction: NormalizedTrendsTransaction,
  projects: Project[],
  organization: Organization,
  currentTrendFunction: string,
  trendParameter: TrendParameter
) {
  const summaryView = eventView.clone();
  const projectID = getTrendProjectId(transaction, projects);
  const target = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction: String(transaction.transaction),
    query: summaryView.generateQueryStringObject(),
    projectID,
    display: DisplayModes.TREND,
    trendFunction: currentTrendFunction,
    additionalQuery: {
      trendParameter: trendParameter.column,
    },
  });
  return target;
}

const PanelBodyWrapper = styled('div')`
  padding: 0 ${space(2)};
  margin-top: ${space(1)};
`;

const HeaderWrapper = styled('div')`
  display: flex;
  flex-wrap: nowrap;
  margin-bottom: ${space(3)};
`;
const HeaderTextWrapper = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;
type ChangeTypeProps = {regression: boolean};

const ChangeType = styled('p')<ChangeTypeProps>`
  color: ${p => (p.regression ? p.theme.danger : p.theme.success)};
  margin-bottom: ${space(0)};
`;

const FireIcon = styled('div')<ChangeTypeProps>`
  padding: ${space(1.5)};
  background-color: ${p => (p.regression ? p.theme.danger : p.theme.success)};
  border-radius: ${space(0.5)};
  margin-right: ${space(2)};
  float: left;
  height: 40px;
`;

const TransactionName = styled('h4')`
  margin-right: ${space(1)};
  margin-bottom: ${space(0)};
  ${p => p.theme.overflowEllipsis};
`;

const TransactionNameWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(3)};
  max-width: fit-content;
`;

const ViewTransactionButton = styled(Button)`
  padding: ${space(0)};
  height: min-content;
  min-height: 0px;
`;

const InfoLabel = styled('strong')`
  color: ${p => p.theme.gray300};
`;
const InfoText = styled('h3')`
  font-weight: normal;
`;
const GraphPanel = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.panelBorderRadius};
  margin-bottom: ${space(2)};
  padding: ${space(3)};
  display: block;
`;

export const ExplorerText = styled('p')<{
  align?: string;
  color?: string;
  margin?: string;
}>`
  margin-bottom: ${p => (p.margin ? p.margin : space(0))};
  color: ${p => p.color};
  text-align: ${p => p.align};
`;
