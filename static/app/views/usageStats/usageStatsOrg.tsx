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
import {DateTimeObject, getInterval} from 'app/components/charts/utils';
import LoadingIndicator from 'app/components/loadingIndicator';
import {parseStatsPeriod} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel, PanelBody} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {IconCalendar, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {DataCategory, IntervalPeriod, Organization, RelativePeriod} from 'app/types';

import {getDateFromMoment} from './usageChart/utils';
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
  dataDatetime: DateTimeObject;
  chartTransform?: string;
  handleChangeState: (state: {
    dataCategory?: DataCategory;
    statsPeriod?: RelativePeriod;
    chartTransform?: ChartDataTransform;
  }) => void;
} & AsyncComponent['props'];

type State = {
  orgStats: UsageSeries | undefined;
} & AsyncComponent['state'];

class UsageStatsOrganization extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [['orgStats', this.endpointPath, {query: this.endpointQuery}]];
  }

  get endpointPath() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQuery() {
    const {dataDatetime} = this.props;

    // TODO: Enable user to use dateStart/dateEnd
    return {
      statsPeriod: dataDatetime?.period || DEFAULT_STATS_PERIOD,
      interval: getInterval(dataDatetime),
      groupBy: ['category', 'outcome'],
      field: ['sum(quantity)'],
    };
  }

  get chartMetadata(): {
    chartData: ChartStats;
    cardData: {
      total: string;
      accepted: string;
      dropped: string;
      filtered: string;
    };
    dataError?: Error;
    chartDateInterval: IntervalPeriod;
    chartDateStart: string;
    chartDateEnd: string;
    chartTransform: ChartDataTransform;
  } {
    const {orgStats} = this.state;

    return {
      ...this.mapSeriesToChart(orgStats),
      ...this.chartDateRange,
      ...this.chartTransform,
    };
  }

  get chartTransform(): {chartTransform: ChartDataTransform} {
    const {chartTransform} = this.props;

    switch (chartTransform) {
      case ChartDataTransform.CUMULATIVE:
      case ChartDataTransform.DAILY:
        return {chartTransform};
      default:
        return {chartTransform: ChartDataTransform.CUMULATIVE};
    }
  }

  get chartDateRange(): {
    chartDateInterval: IntervalPeriod;
    chartDateStart: string;
    chartDateEnd: string;
  } {
    const {dataDatetime} = this.props;
    const {period, start, end} = dataDatetime;
    const interval = getInterval(dataDatetime);

    let chartDateStart = moment().subtract(14, 'd');
    let chartDateEnd = moment();

    try {
      if (start && end) {
        chartDateStart = moment(start);
        chartDateEnd = moment(end);
      }

      if (period) {
        const statsPeriod = parseStatsPeriod(period);
        if (!statsPeriod) {
          throw new Error('Format for data period is not recognized');
        }

        chartDateStart = moment().subtract(
          statsPeriod.period as any, // TODO(ts): Oddity with momentjs types
          statsPeriod.periodLength as any
        );
      }
    } catch (err) {
      // do nothing
    }

    // chartDateStart need to +1 hour to remove empty column on left of chart
    return {
      chartDateInterval: interval,
      chartDateStart: chartDateStart.add(1, 'h').startOf('h').format(),
      chartDateEnd: chartDateEnd.startOf('h').format(),
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
    dataError?: Error;
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
      const {chartDateInterval} = this.chartDateRange;

      const usageStats: UsageStat[] = orgStats.intervals.map(interval => {
        const dateTime = moment(interval);

        return {
          date: getDateFromMoment(dateTime, chartDateInterval),
          total: 0,
          accepted: 0,
          filtered: 0,
          dropped: {total: 0},
        };
      });

      // Tally totals for card data
      const count: any = {
        total: 0,
        accepted: 0,
        dropped: 0,
        invalid: 0,
        filtered: 0,
      };

      orgStats.groups.forEach(group => {
        const {outcome, category} = group.by;

        // HACK The backend enum are singular, but the frontend enums are plural
        if (!dataCategory.includes(`${category}`)) {
          return;
        }

        count.total += group.totals['sum(quantity)'];
        count[outcome] += group.totals['sum(quantity)'];

        group.series['sum(quantity)'].forEach((stat, i) => {
          if (outcome === Outcome.DROPPED || outcome === Outcome.INVALID) {
            usageStats[i].dropped.total += stat;
          }

          usageStats[i][outcome] += stat;
        });
      });

      // Invalid data is dropped
      count.dropped += count.invalid;
      delete count.invalid;

      usageStats.forEach(stat => {
        stat.total = stat.accepted + stat.filtered + stat.dropped.total;

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
          total: formatUsageWithUnits(count.total, dataCategory, formatOptions),
          accepted: formatUsageWithUnits(count.accepted, dataCategory, formatOptions),
          dropped: formatUsageWithUnits(count.dropped, dataCategory, formatOptions),
          filtered: formatUsageWithUnits(count.filtered, dataCategory, formatOptions),
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
        dataError: err,
      };
    }
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
    const {dataCategory} = this.props;
    const {error, loading, orgStats} = this.state;

    if (loading) {
      return (
        <Panel>
          <PanelBody>
            <LoadingIndicator />
          </PanelBody>
        </Panel>
      );
    }

    const {
      chartData,
      dataError,
      chartDateInterval,
      chartDateStart,
      chartDateEnd,
      chartTransform,
    } = this.chartMetadata;

    if (error || dataError || !orgStats) {
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

    return (
      <UsageChart
        footer={this.renderChartFooter()}
        dataCategory={dataCategory}
        dataTransform={chartTransform}
        usageDateStart={chartDateStart}
        usageDateEnd={chartDateEnd}
        usageDateInterval={chartDateInterval}
        usageStats={chartData}
      />
    );
  }

  renderChartFooter = () => {
    const {dataCategory, handleChangeState} = this.props;
    const {chartTransform} = this.chartMetadata;

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
            selected={dataCategory}
            options={CHART_OPTIONS_DATACATEGORY}
            onChange={(val: string) =>
              handleChangeState({dataCategory: val as DataCategory})
            }
          />
          <OptionSelector
            title={t('Type')}
            selected={chartTransform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) =>
              handleChangeState({chartTransform: val as ChartDataTransform})
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
