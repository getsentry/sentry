import React, {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {IconFire} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import theme from 'sentry/utils/theme';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import {MetricsChart} from 'sentry/views/performance/trends/changeExplorerUtils/metricsChart';
import {Chart} from 'sentry/views/performance/trends/chart';
import {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendParameter,
  TrendsStats,
  TrendView,
} from 'sentry/views/performance/trends/types';
import SlideOverPanel from 'sentry/views/starfish/components/slideOverPanel';

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
  const panelRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(panelRef, () => {
    if (!collapsed) {
      onClose();
    }
  });

  const escapeKeyPressed = useKeyPress('Escape');

  useEffect(() => {
    if (escapeKeyPressed) {
      if (!collapsed) {
        onClose();
      }
    }
  }, [escapeKeyPressed, collapsed, onClose]);

  return (
    <SlideOverPanel collapsed={collapsed} ref={panelRef}>
      <CloseButtonWrapper>
        <CloseButton
          priority="link"
          size="zero"
          borderless
          aria-label={t('Close Details')}
          icon={<IconClose size="sm" />}
          onClick={onClose}
        />
      </CloseButtonWrapper>
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
    </SlideOverPanel>
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
    ? new Date(transaction.breakpoint * 1000).toUTCString().replace('GMT', 'UTC')
    : '';
  return (
    <React.Fragment>
      <Header transaction={transaction} trendChangeType={trendChangeType} />
      <ExplorerContainer>
        <ExplorerContainer flex>
          <InfoItem
            float
            margin
            label={
              trendChangeType === TrendChangeType.REGRESSION
                ? t('Regression Metric')
                : t('Improvement Metric')
            }
            value={trendFunction}
          />
          <InfoItem label={t('Start Time')} value={breakpointDate} />
        </ExplorerContainer>
      </ExplorerContainer>
      <GraphPanel data-test-id="pce-graph">
        <strong>{trendParameter.label + ' (' + trendFunction + ')'}</strong>
        <ExplorerText color={theme.gray300} margin={'-' + space(3)}>
          {trendView.statsPeriod
            ? DEFAULT_RELATIVE_PERIODS[trendView.statsPeriod] ||
              getTimeString(trendView.statsPeriod)
            : trendView.start + ' - ' + trendView.end}
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
      <MetricsChart
        isLoading={isLoading}
        location={location}
        transaction={transaction}
        trendFunction={trendFunction}
        trendView={trendView}
        organization={organization}
      />
    </React.Fragment>
  );
}

function getTimeString(time: string) {
  const timeMeasurements = {
    m: 'minutes',
    h: 'hours',
    d: 'days',
    w: 'weeks',
  };

  const suffix = time.charAt(time.length - 1);
  const number = time.slice(0, time.length - 1);
  const measurement =
    number === '1'
      ? timeMeasurements[suffix].slice(0, timeMeasurements[suffix].length - 1)
      : timeMeasurements[suffix];

  const timestring = number === '1' ? measurement : number + ' ' + measurement;
  return tct('Last [timestring]', {timestring});
}

function InfoItem({
  label,
  value,
  margin,
  float,
}: {
  label: string;
  value: string;
  float?: boolean;
  margin?: boolean;
}) {
  return (
    <ExplorerContainer margin={margin} float={float}>
      <Strong>{label}</Strong>
      <LargeText>{value}</LargeText>
    </ExplorerContainer>
  );
}

function Header(props: HeaderProps) {
  const {transaction, trendChangeType} = props;

  const regression = trendChangeType === TrendChangeType.REGRESSION;

  return (
    <HeaderWrapper data-test-id="pce-header">
      <FireIcon regression={regression} />
      <HeaderTextWrapper>
        <ChangeType regression={regression}>
          {regression ? t('Ongoing Regression') : t('Ongoing Improvement')}
        </ChangeType>
        <TransactionName>{transaction.transaction}</TransactionName>
      </HeaderTextWrapper>
    </HeaderWrapper>
  );
}

function FireIcon({regression}: {regression: boolean}) {
  return (
    <IconWrapper regression={regression}>
      <IconFire color="white" />
    </IconWrapper>
  );
}

const CloseButton = styled(Button)`
  color: ${p => p.theme.gray300};
  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

const CloseButtonWrapper = styled('div')`
  justify-content: flex-end;
  display: flex;
  padding: ${space(2)};
`;

const PanelBodyWrapper = styled('div')`
  padding: 0 ${space(4)};
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

const IconWrapper = styled('div')<ChangeTypeProps>`
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
const Strong = styled('strong')`
  color: ${p => p.theme.gray300};
`;
const LargeText = styled('h3')`
  font-weight: normal;
`;
const GraphPanel = styled('div')`
  border: 1px ${p => 'solid ' + p.theme.border};
  border-radius: ${p => p.theme.panelBorderRadius};
  margin-bottom: ${space(2)};
  padding: ${space(3)};
  display: block;
`;

type DivProps = {
  flex?: boolean;
  float?: boolean;
  margin?: boolean;
};

const ExplorerContainer = styled('div')<DivProps>`
  display: ${p => (p.flex ? 'flex' : 'block')};
  float: ${p => (p.float ? 'left' : 'none')};
  margin-right: ${p => (p.margin ? space(4) : space(0))};
`;
type TextProps = {
  align?: string;
  color?: string;
  margin?: string;
};

export const ExplorerText = styled('p')<TextProps>`
  margin-bottom: ${p => (p.margin ? p.margin : space(0))};
  color: ${p => p.color};
  text-align: ${p => p.align};
`;
