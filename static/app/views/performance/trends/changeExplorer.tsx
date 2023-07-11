import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import {getArbitraryRelativePeriod} from 'sentry/components/organizations/timeRangeSelector/utils';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import theme from 'sentry/utils/theme';
import {MetricsTable} from 'sentry/views/performance/trends/changeExplorerUtils/metricsTable';
import {Chart} from 'sentry/views/performance/trends/chart';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendParameter,
  TrendsStats,
  TrendView,
} from 'sentry/views/performance/trends/types';
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
  transaction: NormalizedTrendsTransaction;
  trendChangeType: TrendChangeType;
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
  } = props;
  const breakpointDate = transaction.breakpoint
    ? moment(transaction.breakpoint * 1000).format('ddd, DD MMM YYYY HH:mm:ss z')
    : '';

  const start = moment(trendView.start).format('DD MMM YYYY HH:mm:ss z');
  const end = moment(trendView.end).format('DD MMM YYYY HH:mm:ss z');
  return (
    <Fragment>
      <Header transaction={transaction} trendChangeType={trendChangeType} />
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
  const {transaction, trendChangeType} = props;

  const regression = trendChangeType === TrendChangeType.REGRESSION;

  return (
    <HeaderWrapper data-test-id="pce-header">
      <FireIcon regression={regression}>
        <IconFire color="white" />
      </FireIcon>
      <HeaderTextWrapper>
        <ChangeType regression={regression}>
          {regression ? t('Ongoing Regression') : t('Ongoing Improvement')}
        </ChangeType>
        <TransactionName>{transaction.transaction}</TransactionName>
      </HeaderTextWrapper>
    </HeaderWrapper>
  );
}

const PanelBodyWrapper = styled('div')`
  padding: 0 ${space(2)};
  margin-top: ${space(4)};
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
  ${p => p.theme.overflowEllipsis};
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
