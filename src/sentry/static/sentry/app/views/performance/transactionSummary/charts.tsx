import React from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {OrganizationSummary, SelectValue} from 'app/types';
import {t} from 'app/locale';
import {Panel} from 'app/components/panels';
import EventView from 'app/utils/discover/eventView';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import {decodeScalar} from 'app/utils/queryString';
import OptionSelector from 'app/components/charts/optionSelector';

import {ChartContainer} from '../styles';
import DurationChart from './durationChart';
import LatencyChart from './latencyChart';
import DurationPercentileChart from './durationPercentileChart';

enum DisplayModes {
  DURATION_PERCENTILE = 'durationpercentile',
  DURATION = 'duration',
  LATENCY = 'latency',
  APDEX_THROUGHPUT = 'apdexthroughput',
}

const DISPLAY_OPTIONS: SelectValue<string>[] = [
  {value: DisplayModes.DURATION, label: t('Duration Breakdown')},
  {value: DisplayModes.DURATION_PERCENTILE, label: t('Duration Percentiles')},
  {value: DisplayModes.LATENCY, label: t('Latency Distribution')},
];

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

  render() {
    const {totalValues, eventView, organization, location} = this.props;
    let display = decodeScalar(location.query.display) || DisplayModes.DURATION;
    if (!Object.values(DisplayModes).includes(display as DisplayModes)) {
      display = DisplayModes.DURATION;
    }

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
        </ChartContainer>

        <ChartControls>
          <InlineContainer>
            <SectionHeading key="total-heading">{t('Total Transactions')}</SectionHeading>
            <SectionValue key="total-value">{calculateTotal(totalValues)}</SectionValue>
          </InlineContainer>
          <InlineContainer>
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
