import React from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import OptionSelector from 'app/components/charts/optionSelector';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import {OrganizationSummary, SelectValue} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {TransactionsListOption} from 'app/views/releases/detail/overview';
import {YAxis} from 'app/views/releases/detail/overview/chart/releaseChartControls';

import {ChartContainer} from '../styles';
import {TrendColumnField, TrendFunctionField} from '../trends/types';
import {
  generateTrendFunctionAsString,
  TRENDS_FUNCTIONS,
  TRENDS_PARAMETERS,
} from '../trends/utils';

import DurationChart from './durationChart';
import DurationPercentileChart from './durationPercentileChart';
import LatencyChart from './latencyChart';
import TrendChart from './trendChart';
import VitalsChart from './vitalsChart';

export enum DisplayModes {
  DURATION_PERCENTILE = 'durationpercentile',
  DURATION = 'duration',
  LATENCY = 'latency',
  TREND = 'trend',
  VITALS = 'vitals',
}

const DISPLAY_OPTIONS: SelectValue<string>[] = [
  {value: DisplayModes.DURATION, label: t('Duration Breakdown')},
  {value: DisplayModes.DURATION_PERCENTILE, label: t('Duration Percentiles')},
  {value: DisplayModes.LATENCY, label: t('Duration Distribution')},
  {value: DisplayModes.TREND, label: t('Trends')},
  {value: DisplayModes.VITALS, label: t('Web Vitals')},
];

const TREND_FUNCTIONS_OPTIONS: SelectValue<string>[] = TRENDS_FUNCTIONS.map(
  ({field, label}) => ({
    value: field,
    label,
  })
);
const TREND_PARAMETERS_OPTIONS: SelectValue<string>[] = TRENDS_PARAMETERS.map(
  ({column, label}) => ({
    value: column,
    label,
  })
);

type Props = {
  organization: OrganizationSummary;
  location: Location;
  eventView: EventView;
  totalValues: number | null;
};

class TransactionSummaryCharts extends React.Component<Props> {
  handleDisplayChange = (value: string) => {
    const {location} = this.props;
    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, display: value},
    });
  };

  handleTrendDisplayChange = (value: string) => {
    const {location} = this.props;
    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, trendFunction: value},
    });
  };

  handleTrendColumnChange = (value: string) => {
    const {location} = this.props;
    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, trendColumn: value},
    });
  };

  render() {
    const {totalValues, eventView, organization, location} = this.props;
    let display = decodeScalar(location.query.display, DisplayModes.DURATION);
    let trendFunction = decodeScalar(
      location.query.trendFunction,
      TREND_FUNCTIONS_OPTIONS[0].value
    ) as TrendFunctionField;
    let trendColumn = decodeScalar(
      location.query.trendColumn,
      TREND_PARAMETERS_OPTIONS[0].value
    );

    if (!Object.values(DisplayModes).includes(display as DisplayModes)) {
      display = DisplayModes.DURATION;
    }
    if (!Object.values(TrendFunctionField).includes(trendFunction)) {
      trendFunction = TrendFunctionField.P50;
    }
    if (!Object.values(TrendColumnField).includes(trendColumn as TrendColumnField)) {
      trendColumn = TrendColumnField.DURATION;
    }

    const releaseQueryExtra = {
      yAxis: display === DisplayModes.VITALS ? YAxis.COUNT_VITAL : YAxis.COUNT_DURATION,
      showTransactions:
        display === DisplayModes.VITALS
          ? TransactionsListOption.SLOW_LCP
          : display === DisplayModes.DURATION
          ? TransactionsListOption.SLOW
          : undefined,
    };

    return (
      <Panel>
        <ChartContainer>
          {display === DisplayModes.LATENCY && (
            <LatencyChart
              organization={organization}
              location={location}
              query={eventView.query}
              project={eventView.project}
              environment={eventView.environment}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
            />
          )}
          {display === DisplayModes.DURATION && (
            <DurationChart
              organization={organization}
              query={eventView.query}
              queryExtra={releaseQueryExtra}
              project={eventView.project}
              environment={eventView.environment}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
            />
          )}
          {display === DisplayModes.DURATION_PERCENTILE && (
            <DurationPercentileChart
              organization={organization}
              location={location}
              query={eventView.query}
              project={eventView.project}
              environment={eventView.environment}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
            />
          )}
          {display === DisplayModes.TREND && (
            <TrendChart
              trendDisplay={generateTrendFunctionAsString(trendFunction, trendColumn)}
              organization={organization}
              query={eventView.query}
              queryExtra={releaseQueryExtra}
              project={eventView.project}
              environment={eventView.environment}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
            />
          )}
          {display === DisplayModes.VITALS && (
            <VitalsChart
              organization={organization}
              query={eventView.query}
              queryExtra={releaseQueryExtra}
              project={eventView.project}
              environment={eventView.environment}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
            />
          )}
        </ChartContainer>

        <ChartControls>
          <InlineContainer>
            <SectionHeading key="total-heading">{t('Total Transactions')}</SectionHeading>
            <SectionValue key="total-value">{calculateTotal(totalValues)}</SectionValue>
          </InlineContainer>
          <InlineContainer>
            {display === DisplayModes.TREND && (
              <OptionSelector
                title={t('Trend')}
                selected={trendFunction}
                options={TREND_FUNCTIONS_OPTIONS}
                onChange={this.handleTrendDisplayChange}
              />
            )}
            {display === DisplayModes.TREND && (
              <OptionSelector
                title={t('Parameter')}
                selected={trendColumn}
                options={TREND_PARAMETERS_OPTIONS}
                onChange={this.handleTrendColumnChange}
              />
            )}
            <OptionSelector
              title={t('Display')}
              selected={display}
              options={DISPLAY_OPTIONS}
              onChange={this.handleDisplayChange}
            />
          </InlineContainer>
        </ChartControls>
      </Panel>
    );
  }
}

function calculateTotal(total: number | null) {
  if (total === null) {
    return '\u2014';
  }
  return total.toLocaleString();
}

export default TransactionSummaryCharts;
