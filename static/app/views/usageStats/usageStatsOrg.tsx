import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import Card from 'app/components/card';
import OptionSelector from 'app/components/charts/optionSelector';
import {
  ChartControls,
  HeaderTitle,
  InlineContainer,
  SectionValue,
} from 'app/components/charts/styles';
import {DateTimeObject, getInterval} from 'app/components/charts/utils';
import NotAvailable from 'app/components/notAvailable';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {DataCategory, IntervalPeriod, Organization, RelativePeriod} from 'app/types';
import {parsePeriodToHours} from 'app/utils/dates';

import {
  FORMAT_DATETIME_DAILY,
  FORMAT_DATETIME_HOURLY,
  getDateFromMoment,
} from './usageChart/utils';
import {Outcome, UsageSeries, UsageStat} from './types';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  CHART_OPTIONS_DATACATEGORY,
  ChartDataTransform,
  ChartStats,
} from './usageChart';
import {formatUsageWithUnits, getFormatUsageOptions} from './utils';

type Props = {
  organization: Organization;
  dataCategory: DataCategory;
  dataCategoryName: string;
  dataDatetime: DateTimeObject;
  chartTransform?: string;
  handleChangeState: (state: {
    dataCategory?: DataCategory;
    pagePeriod?: RelativePeriod;
    chartTransform?: ChartDataTransform;
  }) => void;
} & AsyncComponent['props'];

type State = {
  orgStats: UsageSeries | undefined;
} & AsyncComponent['state'];

class UsageStatsOrganization extends AsyncComponent<Props, State> {
  componentDidUpdate(prevProps: Props) {
    const {dataDatetime: prevDateTime} = prevProps;
    const {dataDatetime: currDateTime} = this.props;

    if (
      prevDateTime.start !== currDateTime.start ||
      prevDateTime.end !== currDateTime.end ||
      prevDateTime.period !== currDateTime.period
    ) {
      this.reloadData();
    }
  }

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

  get chartData(): {
    chartStats: ChartStats;
    cardStats: {
      total?: string;
      accepted?: string;
      dropped?: string;
      filtered?: string;
    };
    dataError?: Error;
    chartDateInterval: IntervalPeriod;
    chartDateStart: string;
    chartDateEnd: string;
    chartDateStartDisplay: string;
    chartDateEndDisplay: string;
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
      case ChartDataTransform.PERIODIC:
        return {chartTransform};
      default:
        return {chartTransform: ChartDataTransform.PERIODIC};
    }
  }

  get chartDateRange(): {
    chartDateInterval: IntervalPeriod;
    chartDateStart: string;
    chartDateEnd: string;
    chartDateStartDisplay: string;
    chartDateEndDisplay: string;
  } {
    const {orgStats} = this.state;

    // Use fillers as loading/error states will not display datetime at all
    if (!orgStats || !orgStats.intervals || orgStats.intervals.length < 2) {
      const now = moment();

      return {
        chartDateInterval: '1d',
        chartDateStart: now.format(),
        chartDateEnd: now.format(),
        chartDateStartDisplay: now.local().format(FORMAT_DATETIME_DAILY),
        chartDateEndDisplay: now.local().format(FORMAT_DATETIME_DAILY),
      };
    }

    const {intervals} = orgStats;

    const startTime = moment(intervals[0]);
    const endTime = moment(intervals[intervals.length - 1]);
    const intervalMinutes = moment(endTime).diff(startTime, 'm') / (intervals.length - 1);

    const FORMAT_DATETIME =
      intervalMinutes >= 24 * 60 ? FORMAT_DATETIME_DAILY : FORMAT_DATETIME_HOURLY;

    const xAxisStart = moment(startTime);
    const xAxisEnd = moment(endTime);
    const displayStart = moment(startTime);
    const displayEnd = moment(endTime).add(intervalMinutes, 'm');

    return {
      chartDateInterval: `${intervalMinutes}m` as IntervalPeriod,
      chartDateStart: xAxisStart.format(),
      chartDateEnd: xAxisEnd.format(),
      chartDateStartDisplay: displayStart.local().format(FORMAT_DATETIME),
      chartDateEndDisplay: displayEnd.local().format(FORMAT_DATETIME),
    };
  }

  mapSeriesToChart(
    orgStats?: UsageSeries
  ): {
    chartStats: ChartStats;
    cardStats: {
      total?: string;
      accepted?: string;
      dropped?: string;
      filtered?: string;
    };
    dataError?: Error;
  } {
    const cardStats = {
      total: undefined,
      accepted: undefined,
      dropped: undefined,
      filtered: undefined,
    };
    const chartStats: ChartStats = {
      accepted: [],
      dropped: [],
      projected: [],
    };

    if (!orgStats) {
      return {cardStats, chartStats};
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

        // HACK: The backend enum are singular, but the frontend enums are plural
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
        chartStats.accepted.push({value: [stat.date, stat.accepted]} as any);
        chartStats.dropped.push({value: [stat.date, stat.dropped.total]} as any);
      });

      return {
        cardStats: {
          total: formatUsageWithUnits(
            count.total,
            dataCategory,
            getFormatUsageOptions(dataCategory)
          ),
          accepted: formatUsageWithUnits(
            count.accepted,
            dataCategory,
            getFormatUsageOptions(dataCategory)
          ),
          dropped: formatUsageWithUnits(
            count.dropped,
            dataCategory,
            getFormatUsageOptions(dataCategory)
          ),
          filtered: formatUsageWithUnits(
            count.filtered,
            dataCategory,
            getFormatUsageOptions(dataCategory)
          ),
        },
        chartStats,
      };
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setContext('query', this.endpointQuery);
        scope.setContext('body', orgStats);
        Sentry.captureException(err);
      });

      return {
        cardStats,
        chartStats,
        dataError: new Error('Failed to parse stats data'),
      };
    }
  }

  renderCards() {
    const {dataCategory, dataCategoryName} = this.props;
    const {total, accepted, dropped, filtered} = this.chartData.cardStats;

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
              <TextOverflow>{c.value ?? <NotAvailable />}</TextOverflow>
            </CardContent>
          </StyledCard>
        ))}
      </CardWrapper>
    );
  }

  renderChart() {
    const {dataCategory} = this.props;
    const {error, errors, loading} = this.state;

    const {
      chartStats,
      dataError,
      chartDateInterval,
      chartDateStart,
      chartDateEnd,
      chartDateStartDisplay,
      chartDateEndDisplay,
      chartTransform,
    } = this.chartData;

    const hasError = error || !!dataError;
    const chartErrors: any = dataError ? {...errors, data: dataError} : errors; // TODO(ts): AsyncComponent

    return (
      <UsageChart
        isLoading={loading}
        isError={hasError}
        errors={chartErrors}
        title={tct('Usage for [start] — [end]', {
          start: chartDateStartDisplay,
          end: chartDateEndDisplay,
        })}
        footer={this.renderChartFooter()}
        dataCategory={dataCategory}
        dataTransform={chartTransform}
        usageDateStart={chartDateStart}
        usageDateEnd={chartDateEnd}
        usageDateInterval={chartDateInterval}
        usageStats={chartStats}
      />
    );
  }

  renderChartFooter = () => {
    const {dataCategory, dataDatetime, handleChangeState} = this.props;
    const {chartTransform} = this.chartData;

    const {period} = dataDatetime;

    // Remove options for relative periods shorter than 1 week
    const relativePeriods = Object.keys(DEFAULT_RELATIVE_PERIODS).reduce((acc, key) => {
      const periodDays = parsePeriodToHours(key) / 24;
      if (periodDays >= 7) {
        acc[key] = DEFAULT_RELATIVE_PERIODS[key];
      }
      return acc;
    }, {});

    return (
      <ChartControls>
        <InlineContainer>
          <SectionValue>
            <OptionSelector
              title={t('Display')}
              selected={period || DEFAULT_STATS_PERIOD}
              options={Object.keys(relativePeriods).map(k => ({
                label: DEFAULT_RELATIVE_PERIODS[k],
                value: k,
              }))}
              onChange={(val: string) =>
                handleChangeState({pagePeriod: val as RelativePeriod})
              }
            />
          </SectionValue>
          <SectionValue>
            <OptionSelector
              title={t('of')}
              selected={dataCategory}
              options={CHART_OPTIONS_DATACATEGORY}
              onChange={(val: string) =>
                handleChangeState({dataCategory: val as DataCategory})
              }
            />
          </SectionValue>
        </InlineContainer>
        <InlineContainer>
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
