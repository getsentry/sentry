import React from 'react';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {Organization} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {WebVital, getAggregateAlias} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';

import {NUM_BUCKETS, PERCENTILE, WEB_VITAL_DETAILS} from './constants';
import VitalCard from './vitalCard';
import MeasurementsHistogramQuery from './measurementsHistogramQuery';

type Props = {
  organization: Organization;
  location: Location;
  eventView: EventView;
  dataFilter?: string;
};

class TransactionVitals extends React.Component<Props> {
  render() {
    const {location, organization, eventView, dataFilter} = this.props;
    const vitals = Object.values(WebVital);

    const colors = [...theme.charts.getColorPalette(vitals.length - 1)].reverse();

    const min = decodeScalar(location.query.startMeasurements);
    const max = decodeScalar(location.query.endMeasurements);

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
                min={min}
                max={max}
                dataFilter={dataFilter}
              >
                {results => (
                  <React.Fragment>
                    {vitals.map((vital, index) => {
                      const details = WEB_VITAL_DETAILS[vital];
                      const error =
                        summaryResults.error !== null || results.error !== null;
                      const percentile_alias = getAggregateAlias(
                        `percentile(${vital}, ${PERCENTILE})`
                      );
                      const count_alias = getAggregateAlias(`count_geq(${vital}, 0)`);
                      const failed_alias = getAggregateAlias(
                        `count_geq(${vital}, ${details.failureThreshold})`
                      );
                      const data = summaryResults.tableData?.data?.[0];
                      const summary = (data?.[percentile_alias] ?? null) as number | null;
                      const numerator = (data?.[failed_alias] ?? 0) as number;
                      const denominator = (data?.[count_alias] ?? 0) as number;
                      const failureRate =
                        denominator <= 0 ? null : numerator / denominator;
                      return (
                        <VitalCard
                          key={vital}
                          location={location}
                          isLoading={summaryResults.isLoading || results.isLoading}
                          error={error}
                          vital={details}
                          summary={summary}
                          failureRate={failureRate}
                          chartData={results.histograms?.[vital] ?? []}
                          colors={[colors[index]]}
                          eventView={eventView}
                          organization={organization}
                          min={min}
                          max={max}
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
