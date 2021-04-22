import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import OptionSelector from 'app/components/charts/optionSelector';
import {InlineContainer, SectionHeading} from 'app/components/charts/styles';
import {DateTimeObject, getInterval} from 'app/components/charts/utils';
import NotAvailable from 'app/components/notAvailable';
import ScoreCard from 'app/components/scoreCard';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {DataCategory, IntervalPeriod, Organization, RelativePeriod} from 'app/types';

import {
  FORMAT_DATETIME_DAILY,
  FORMAT_DATETIME_HOURLY,
  getDateFromMoment,
} from './usageChart/utils';
import {Outcome, UsageSeries, UsageStat} from './types';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  ChartDataTransform,
  ChartStats,
} from './usageChart';
import UsageStatsPerMin from './usageStatsPerMin';
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
      const {dataDatetime} = this.props;

      return {
        chartDateInterval: getInterval(dataDatetime),
        chartDateStart: '',
        chartDateEnd: '',
        chartDateStartDisplay: '',
        chartDateEndDisplay: '',
      };
    }

    // Calculate intervals using API data
    const {intervals} = orgStats;
    const startTime = moment(intervals[0]);
    const endTime = moment(intervals[intervals.length - 1]);
    const intervalMinutes = moment(endTime).diff(startTime, 'm') / (intervals.length - 1);

    // If interval is a day or more, use UTC to format date. Otherwise, the date
    // may shift ahead/behind when converting to the user's local time.
    const isPerDay = intervalMinutes >= 24 * 60;
    const FORMAT_DATETIME = isPerDay ? FORMAT_DATETIME_DAILY : FORMAT_DATETIME_HOURLY;

    const xAxisStart = moment(startTime);
    const xAxisEnd = moment(endTime);
    const displayStart = isPerDay ? moment(startTime).utc() : moment(startTime).local();
    const displayEnd = isPerDay
      ? moment(endTime).utc()
      : moment(endTime).local().add(intervalMinutes, 'm');

    const intervalString =
      intervalMinutes < 60
        ? `${intervalMinutes}m`
        : intervalMinutes < 60 * 24
        ? `${intervalMinutes / 60}h`
        : `${intervalMinutes / (60 * 24)}d`;

    return {
      chartDateInterval: intervalString as IntervalPeriod,
      chartDateStart: xAxisStart.format(),
      chartDateEnd: xAxisEnd.format(),
      chartDateStartDisplay: displayStart.format(FORMAT_DATETIME),
      chartDateEndDisplay: displayEnd.format(FORMAT_DATETIME),
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
    const {dataCategory, dataCategoryName, organization} = this.props;
    const {loading} = this.state;
    const {total, accepted, dropped, filtered} = this.chartData.cardStats;

    const cardMetadata = [
      {
        title: tct('Total [dataCategory]', {dataCategory: dataCategoryName}),
        value: total,
      },
      {
        title: t('Accepted'),
        help: tct('Accepted [dataCategory] were successfully processed by Sentry', {
          dataCategory,
        }),
        value: accepted,
        secondaryValue: (
          <UsageStatsPerMin organization={organization} dataCategory={dataCategory} />
        ),
      },
      {
        title: t('Filtered'),
        help: tct(
          'Filtered [dataCategory] were blocked due to your inbound data filter rules',
          {dataCategory}
        ),
        value: filtered,
      },
      {
        title: t('Dropped'),
        help: tct(
          'Dropped [dataCategory] were discarded due to invalid data, rate-limits, quota limits, or spike protection',
          {dataCategory}
        ),
        value: dropped,
      },
    ];

    return cardMetadata.map((card, i) => (
      <StyledScoreCard
        key={i}
        title={card.title}
        score={loading ? undefined : card.value}
        help={card.help}
        trend={card.secondaryValue}
      />
    ));
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
      chartTransform,
    } = this.chartData;

    const hasError = error || !!dataError;
    const chartErrors: any = dataError ? {...errors, data: dataError} : errors; // TODO(ts): AsyncComponent

    return (
      <UsageChart
        isLoading={loading}
        isError={hasError}
        errors={chartErrors}
        title=" " // Force the title to be blank
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
    const {handleChangeState} = this.props;
    const {loading} = this.state;
    const {
      chartDateInterval,
      chartTransform,
      chartDateStartDisplay,
      chartDateEndDisplay,
    } = this.chartData;

    return (
      <Footer>
        <InlineContainer>
          <FooterDate>
            <SectionHeading>{t('Date Range')}</SectionHeading>
            <span>
              {loading ? (
                <NotAvailable />
              ) : (
                tct('[start] — [end] ([interval] interval)', {
                  start: chartDateStartDisplay,
                  end: chartDateEndDisplay,
                  interval: chartDateInterval,
                })
              )}
            </span>
          </FooterDate>
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
      </Footer>
    );
  };

  renderComponent() {
    return (
      <React.Fragment>
        {this.renderCards()}
        <ChartWrapper>{this.renderChart()}</ChartWrapper>
      </React.Fragment>
    );
  }
}

export default UsageStatsOrganization;

const StyledScoreCard = styled(ScoreCard)`
  grid-column: auto / span 1;
  margin: 0;
`;

const ChartWrapper = styled('div')`
  grid-column: 1 / -1;
`;

const Footer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.border};
`;
const FooterDate = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;

  > ${SectionHeading} {
    margin-right: ${space(1.5)};
  }

  > span:last-child {
    font-weight: 400;
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;
