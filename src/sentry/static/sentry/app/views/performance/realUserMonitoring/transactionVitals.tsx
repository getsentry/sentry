import React from 'react';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {Organization} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
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
  render() {
    const {location, organization, eventView} = this.props;
    const vitals = Object.values(WebVital);

    const colors = [...theme.charts.getColorPalette(vitals.length - 1)].reverse();

    return (
      <DiscoverQuery
        location={location}
        orgSlug={organization.slug}
        eventView={eventView}
        limit={1}
      >
        {summaryResults => {
          return (
            <Panel>
              <MeasurementsHistogramQuery
                location={location}
                orgSlug={organization.slug}
                eventView={eventView}
                numBuckets={NUM_BUCKETS}
                measurements={vitals.map(vital => WEB_VITAL_DETAILS[vital].slug)}
                min={decodeScalar(location.query.startMeasurements)}
                max={decodeScalar(location.query.endMeasurements)}
              >
                {results => (
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
                          location={location}
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
                )}
              </MeasurementsHistogramQuery>
            </Panel>
          );
        }}
      </DiscoverQuery>
    );
  }
}

export default TransactionVitals;
