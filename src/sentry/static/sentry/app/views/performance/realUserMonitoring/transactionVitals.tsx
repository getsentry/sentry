import React from 'react';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {Organization} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {WebVital, getAggregateAlias} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';

import {NUM_BUCKETS, PERCENTILE, WEB_VITAL_DETAILS, VITAL_GROUPS} from './constants';
import {HistogramData} from './types';
import VitalCard from './vitalCard';
import MeasurementsHistogramQuery from './measurementsHistogramQuery';

type Props = {
  organization: Organization;
  location: Location;
  eventView: EventView;
  dataFilter?: string;
};

class TransactionVitals extends React.Component<Props> {
  renderVitalCard(
    vital: WebVital,
    isLoading: boolean,
    error: boolean,
    summary: number | null,
    histogram: HistogramData[],
    color: [string],
    min?: string,
    max?: string
  ) {
    const {location, organization, eventView, dataFilter} = this.props;
    const vitalDetails = WEB_VITAL_DETAILS[vital];

    if (min !== undefined || max !== undefined) {
      return (
        <MeasurementsHistogramQuery
          location={location}
          orgSlug={organization.slug}
          eventView={eventView}
          numBuckets={NUM_BUCKETS}
          measurements={[vitalDetails.slug]}
          dataFilter={dataFilter}
          min={min}
          max={max}
        >
          {results => (
            <VitalCard
              location={location}
              isLoading={isLoading || results.isLoading}
              error={error || results.error !== null}
              vital={vitalDetails}
              summary={summary}
              chartData={results.histograms?.[vital] ?? []}
              colors={color}
              eventView={eventView}
              organization={organization}
              min={min}
              max={max}
            />
          )}
        </MeasurementsHistogramQuery>
      );
    } else {
      return (
        <VitalCard
          location={location}
          isLoading={isLoading}
          error={error}
          vital={vitalDetails}
          summary={summary}
          chartData={histogram}
          colors={color}
          eventView={eventView}
          organization={organization}
        />
      );
    }
  }

  renderVitalGroup(vitals: WebVital[], summaryResults: any, colors: string[]) {
    const {location, organization, eventView, dataFilter} = this.props;

    return (
      <MeasurementsHistogramQuery
        location={location}
        orgSlug={organization.slug}
        eventView={eventView}
        numBuckets={NUM_BUCKETS}
        measurements={vitals.map(vital => WEB_VITAL_DETAILS[vital].slug)}
        dataFilter={dataFilter}
      >
        {multiHistogramResults => {
          const isLoading = summaryResults.isLoading || multiHistogramResults.isLoading;
          const error =
            summaryResults.error !== null || multiHistogramResults.error !== null;
          return (
            <React.Fragment>
              {vitals.map((vital, index) => {
                const alias = getAggregateAlias(`percentile(${vital}, ${PERCENTILE})`);
                const summary = summaryResults.tableData?.data?.[0]?.[alias] ?? null;
                const vitalSlug = WEB_VITAL_DETAILS[vital].slug;

                return (
                  <React.Fragment key={vital}>
                    {this.renderVitalCard(
                      vital,
                      isLoading,
                      error,
                      summary,
                      multiHistogramResults.histograms?.[vital] ?? [],
                      [colors[index]],
                      decodeScalar(location.query[`${vitalSlug}Start`]),
                      decodeScalar(location.query[`${vitalSlug}End`])
                    )}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        }}
      </MeasurementsHistogramQuery>
    );
  }

  render() {
    const {location, organization, eventView} = this.props;

    return (
      <Panel>
        <DiscoverQuery
          location={location}
          orgSlug={organization.slug}
          eventView={eventView}
          limit={1}
        >
          {results => (
            <React.Fragment>
              {VITAL_GROUPS.map(vitalGroup => (
                <React.Fragment key={vitalGroup.group.join('')}>
                  {this.renderVitalGroup(vitalGroup.group, results, vitalGroup.colors)}
                </React.Fragment>
              ))}
            </React.Fragment>
          )}
        </DiscoverQuery>
      </Panel>
    );
  }
}

export default TransactionVitals;
