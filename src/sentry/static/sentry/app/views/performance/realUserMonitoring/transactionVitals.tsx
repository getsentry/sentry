import React from 'react';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {Organization} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias} from 'app/utils/discover/fields';
import theme from 'app/utils/theme';

import {NUM_BUCKETS, PERCENTILE, WEB_VITAL_DETAILS} from './constants';
import {WebVital} from './types';
import VitalCard from './vitalCard';
import MeasurementsHistogramQuery from './measurementsHistogramQuery';

type Props = {
  organization: Organization;
  location: Location;
  eventView: EventView;
};

class TransactionVitals extends React.Component<Props> {
  generateSummaryEventView() {
    const {eventView} = this.props;

    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: Object.values(WebVital).map(vital => `percentile(${vital}, ${PERCENTILE})`),
      projects: eventView.project,
      range: eventView.statsPeriod,
      query: eventView.query,
      environment: eventView.environment,
      start: eventView.start,
      end: eventView.end,
    });
  }

  render() {
    const {location, organization, eventView} = this.props;
    const vitals = Object.values(WebVital);

    const colors = [...theme.charts.getColorPalette(vitals.length - 1)].reverse();

    return (
      <DiscoverQuery
        location={location}
        orgSlug={organization.slug}
        eventView={this.generateSummaryEventView()}
        limit={1}
      >
        {summaryResults => {
          return (
            <Panel>
              <MeasurementsHistogramQuery
                location={location}
                organization={organization}
                eventView={eventView}
                numBuckets={NUM_BUCKETS}
                measurements={vitals.map(vital => WEB_VITAL_DETAILS[vital].slug)}
              >
                {results => {
                  return (
                    <React.Fragment>
                      {vitals.map((vital, index) => {
                        const error =
                          summaryResults.error !== null || results.error !== null;
                        const alias = getAggregateAlias(
                          `percentile(${vital}, ${PERCENTILE})`
                        );
                        const summary =
                          summaryResults.tableData?.data?.[0]?.[alias] ?? null;
                        return (
                          <VitalCard
                            key={vital}
                            isLoading={summaryResults.isLoading || results.isLoading}
                            error={error}
                            vital={WEB_VITAL_DETAILS[vital]}
                            summary={summary as number | null}
                            chartData={results.histograms[vital] ?? []}
                            colors={[colors[index]]}
                          />
                        );
                      })}
                    </React.Fragment>
                  );
                }}
              </MeasurementsHistogramQuery>
            </Panel>
          );
        }}
      </DiscoverQuery>
    );
  }
}

export default TransactionVitals;
