import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import Card from 'app/components/card';
import ErrorPanel from 'app/components/charts/errorPanel';
import OptionSelector from 'app/components/charts/optionSelector';
import {
  ChartControls,
  HeaderTitle,
  InlineContainer,
  SectionValue,
} from 'app/components/charts/styles';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import {IconCalendar, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {DataCategory, Organization} from 'app/types';

import {Outcome, UsageSeries, UsageStat} from './types';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  CHART_OPTIONS_DATACATEGORY,
  ChartDataTransform,
  ChartStats,
} from './usageChart';
import {formatUsageWithUnits} from './utils';

type Props = {
  organization: Organization;
  dataCategory: DataCategory;
  dataCategoryName: string;
  dateStart: moment.Moment;
  dateEnd: moment.Moment;
  onChangeDataCategory: (dataCategory: DataCategory) => void;
  onChangeDateRange: (dateStart: moment.Moment, dateEnd: moment.Moment) => void;
} & AsyncComponent['props'];

type State = {
  orgStats: UsageSeries | undefined;
  chartDataTransform: ChartDataTransform;
} & AsyncComponent['state'];

class UsageStatsOrganization extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      chartDataTransform: ChartDataTransform.CUMULATIVE,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [['orgStats', this.endpointPath, {query: this.endpointQuery}]];
  }

  get endpointPath() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    const {dateStart, dateEnd} = this.props;
    return {
      statsPeriod: `${dateEnd.diff(dateStart, 'd')}d`, // TODO(org-stats)
      interval: '1d', // TODO(org-stats)
      groupBy: ['category', 'outcome'],
      field: ['sum(quantity)', 'sum(times_seen)'],
    };
  }

  get chartMetadata() {
    const {orgStats} = this.state;

    return {
      ...this.mapSeriesToChart(orgStats),
    };
  }

  handleSelectDataTransform(value: ChartDataTransform) {
    this.setState({chartDataTransform: value});
  }

  mapSeriesToChart(
    orgStats?: UsageSeries
  ): {
    chartData: ChartStats;
    cardData: {
      total: string;
      accepted: string;
      dropped: string;
      filtered: string;
    };
    error?: Error;
  } {
    const cardData = {
      total: '-',
      accepted: '-',
      dropped: '-',
      filtered: '-',
    };
    const chartData: ChartStats = {
      accepted: [],
      dropped: [],
      projected: [],
    };

    if (!orgStats) {
      return {cardData, chartData};
    }

    try {
      const {dataCategory} = this.props;
      const rollup = '1d'; // TODO(org-stats)
      const dateTimeFormat = rollup === '1d' ? 'MMM D' : 'MMM D, HH:mm';

      const usageStats: UsageStat[] = orgStats.intervals.map(interval => {
        const dateTime = moment(interval);

        return {
          date: dateTime.format(dateTimeFormat),
          total: 0,
          accepted: 0,
          filtered: 0,
          dropped: {total: 0},
        };
      });

      orgStats.groups.forEach(group => {
        const {outcome, category} = group.by;
        if (category !== dataCategory) {
          return;
        }

        const stats = this.mapSeriesToStats(dataCategory, group.series);
        stats.forEach((stat, i) => {
          usageStats[i][outcome] = outcome === Outcome.DROPPED ? {total: stat} : stat;
        });
      });

      let sumTotal = 0;
      let sumAccepted = 0;
      let sumDropped = 0;
      let sumFiltered = 0;
      usageStats.forEach(stat => {
        stat.total = stat.accepted + stat.filtered + stat.dropped.total;

        // Card Data
        sumTotal += stat.total;
        sumAccepted += stat.accepted;
        sumDropped += stat.dropped.total;
        sumFiltered += stat.filtered;

        // Chart Data
        chartData.accepted.push({value: [stat.date, stat.accepted]} as any);
        chartData.dropped.push({value: [stat.date, stat.dropped.total]} as any);
      });

      const formatOptions = {
        isAbbreviated: dataCategory !== DataCategory.ATTACHMENTS,
        useUnitScaling: dataCategory === DataCategory.ATTACHMENTS,
      };

      return {
        cardData: {
          total: formatUsageWithUnits(sumTotal, dataCategory, formatOptions),
          accepted: formatUsageWithUnits(sumAccepted, dataCategory, formatOptions),
          dropped: formatUsageWithUnits(sumDropped, dataCategory, formatOptions),
          filtered: formatUsageWithUnits(sumFiltered, dataCategory, formatOptions),
        },
        chartData,
      };
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setContext('query', this.endpointQuery);
        scope.setContext('body', orgStats);
        Sentry.captureException(err);
      });

      return {
        cardData,
        chartData,
        error: err,
      };
    }
  }

  mapSeriesToStats(dataCategory: DataCategory, series: Record<string, number[]>) {
    if (
      dataCategory === DataCategory.ATTACHMENTS ||
      dataCategory === DataCategory.TRANSACTIONS
    ) {
      return series['sum(times_seen)'];
    }

    return series['sum(quantity)'];
  }

  renderCards() {
    const {dataCategory, dataCategoryName} = this.props;
    const {total, accepted, dropped, filtered} = this.chartMetadata.cardData;

    const cardMetadata = [
      {
        title: tct('Total [dataCategory]', {dataCategory: dataCategoryName}),
        value: total,
      },
      {
        title: t('Accepted'),
        value: accepted,
      },
      {
        title: t('Filtered'),
        description: tct(
          'Filtered [dataCategory] were blocked due to your inbound data filter rules',
          {dataCategory}
        ),
        value: filtered,
      },
      // TODO(org-stats): Need a better description for dropped data
      {
        title: t('Dropped'),
        description: tct(
          'Dropped [dataCategory] were discarded due to rate-limits, quota limits, or spike protection',
          {dataCategory}
        ),
        value: dropped,
      },
    ];

    return (
      <CardWrapper>
        {cardMetadata.map((c, i) => (
          <StyledCard key={i}>
            <HeaderTitle>
              <TextOverflow>{c.title}</TextOverflow>
              {c.description && (
                <QuestionTooltip size="sm" position="top" title={c.description} />
              )}
            </HeaderTitle>
            <CardContent>
              <TextOverflow>{c.value}</TextOverflow>
            </CardContent>
          </StyledCard>
        ))}
      </CardWrapper>
    );
  }

  renderChart() {
    const {dateStart, dateEnd, dataCategory} = this.props;
    const {chartDataTransform, error, loading, orgStats} = this.state;

    if (loading) {
      return (
        <Panel>
          <PanelBody>
            <LoadingIndicator />
          </PanelBody>
        </Panel>
      );
    }

    const {chartData, error: chartError} = this.chartMetadata;

    if (error || chartError || !orgStats) {
      return (
        <Panel>
          <PanelBody>
            <ErrorPanel height="256px">
              <IconWarning color="gray300" size="lg" />
            </ErrorPanel>
          </PanelBody>
        </Panel>
      );
    }

    const usageDateStart = dateStart.format('YYYY-MM-DD');
    const usageDateEnd = dateEnd.format('YYYY-MM-DD');

    return (
      <UsageChart
        footer={this.renderChartFooter()}
        dataCategory={dataCategory}
        dataTransform={chartDataTransform}
        usageDateStart={usageDateStart}
        usageDateEnd={usageDateEnd}
        usageStats={chartData}
      />
    );
  }

  renderChartFooter = () => {
    const {dataCategory, onChangeDataCategory} = this.props;
    const {chartDataTransform} = this.state;

    return (
      <ChartControls>
        <InlineContainer>
          <SectionValue>
            <IconCalendar />
          </SectionValue>
          <SectionValue>
            {/*
            TODO(org-stats): Add calendar dropdown for user to select date range

            {moment(usagePeriodStart).format('ll')}
            {' — '}
            {moment(usagePeriodEnd).format('ll')}
            */}
          </SectionValue>
        </InlineContainer>
        <InlineContainer>
          <OptionSelector
            title={t('Display')}
            menuWidth="135px"
            selected={dataCategory}
            options={CHART_OPTIONS_DATACATEGORY}
            onChange={(val: string) => onChangeDataCategory(val as DataCategory)}
          />
          <OptionSelector
            title={t('Type')}
            selected={chartDataTransform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) =>
              this.handleSelectDataTransform(val as ChartDataTransform)
            }
          />
        </InlineContainer>
      </ChartControls>
    );
  };

  renderComponent() {
    return (
      <React.Fragment>
        {this.renderCards()}
        {this.renderChart()}
      </React.Fragment>
    );
  }
}

export default UsageStatsOrganization;

const CardWrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  grid-auto-rows: 1fr;
  grid-gap: ${space(2)};
  margin-bottom: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-auto-flow: row;
  }
`;

const StyledCard = styled(Card)`
  align-items: flex-start;
  min-height: 95px;
  padding: ${space(2)} ${space(3)};
  color: ${p => p.theme.textColor};
`;

const CardContent = styled('div')`
  margin-top: ${space(1)};
  font-size: 32px;
`;
