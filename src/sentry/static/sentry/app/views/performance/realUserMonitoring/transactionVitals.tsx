import React from 'react';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import theme from 'app/utils/theme';

import {DURATION_VITALS, NON_DURATION_VITALS, WEB_VITAL_DETAILS} from './constants';
import {WebVital} from './types';
import VitalCard from './vitalCard';
import MeasuresHistogramQuery from './measuresHistogramQuery';

type Props = {
  organization: Organization;
  location: Location;
  eventView: EventView;
};

class TransactionVitals extends React.Component<Props> {
  renderVitals(vitals, summaryResults, colors) {
    const {location, organization, eventView} = this.props;

    // TODO(tonyx): remove
    const max = vitals[0] === WebVital.CLS ? 1 : 10000;
    const min = 0;

    return (
      <MeasuresHistogramQuery
        location={location}
        organization={organization}
        eventView={eventView}
        measures={vitals}
        min={min}
        max={max}
      >
        {results => {
          return (
            <React.Fragment>
              {vitals.map((vital, index) => (
                <VitalCard
                  key={vital}
                  isLoading={results.isLoading}
                  error={results.errors.length > 0}
                  vital={WEB_VITAL_DETAILS[vital]}
                  summary={summaryResults[vital]!}
                  chartData={results.histogram[vital]!}
                  colors={[colors[index]]}
                />
              ))}
            </React.Fragment>
          );
        }}
      </MeasuresHistogramQuery>
    );
  }

  render() {
    const colors = [
      ...theme.charts.getColorPalette(
        DURATION_VITALS.length + NON_DURATION_VITALS.length - 1
      ),
    ].reverse();

    // TODO(tonyx): replace this with DiscoverQuery for the actual info
    const summaryResults = [...DURATION_VITALS, ...NON_DURATION_VITALS].reduce(
      (summary, vital) => {
        const max = vital === WebVital.CLS ? 1 : 10000;
        const min = 0;
        summary[vital] = Math.random() * (max - min) + min;
        return summary;
      },
      {}
    );

    return (
      <Panel>
        {this.renderVitals(
          DURATION_VITALS,
          summaryResults,
          colors.slice(0, colors.length)
        )}
        {this.renderVitals(
          NON_DURATION_VITALS,
          summaryResults,
          colors.slice(
            DURATION_VITALS.length,
            DURATION_VITALS.length + NON_DURATION_VITALS.length
          )
        )}
      </Panel>
    );
  }
}

export default TransactionVitals;
