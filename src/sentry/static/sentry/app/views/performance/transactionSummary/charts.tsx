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
import OptionSelector from 'app/components/charts/optionSelector';

import {ChartsContainer} from '../styles';
import DurationChart from './durationChart';
import LatencyChart from './latencyChart';

enum DisplayModes {
  DURATION = 'duration',
  LATENCY = 'latency',
}

const DISPLAY_OPTIONS: SelectValue<string>[] = [
  {value: DisplayModes.LATENCY, label: t('Latency Distribution')},
  {value: DisplayModes.DURATION, label: t('Duration Breakdown')},
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
    const display = location.query.display
      ? Array.isArray(location.query.display)
        ? location.query.display[0]
        : location.query.display
      : DisplayModes.LATENCY;

    return (
      <Panel>
        <ChartsContainer>
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
        </ChartsContainer>

        <ChartControls>
          <InlineContainer>
            <SectionHeading key="total-heading">{t('Total Events')}</SectionHeading>
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
