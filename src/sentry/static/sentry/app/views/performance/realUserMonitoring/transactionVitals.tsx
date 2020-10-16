import React from 'react';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {Organization} from 'app/types';
import DiscoverQuery, {TableData} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {WebVital, getAggregateAlias} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {GenericChildrenProps} from 'app/utils/discover/genericDiscoverQuery';

import {NUM_BUCKETS, PERCENTILE, WEB_VITAL_DETAILS, VITAL_GROUPS} from './constants';
import {HistogramData, VitalGroup} from './types';
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
    failureRate: number,
    histogram: HistogramData[],
    color: [string],
    min?: number,
    max?: number,
    precision?: number
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
          min={min}
          max={max}
          precision={precision}
          dataFilter={dataFilter}
        >
          {results => (
            <VitalCard
              location={location}
              isLoading={isLoading || results.isLoading}
              error={error || results.error !== null}
              vital={vitalDetails}
              summary={summary}
              failureRate={failureRate}
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
          failureRate={failureRate}
          chartData={histogram}
          colors={color}
          eventView={eventView}
          organization={organization}
        />
      );
    }
  }

  renderVitalGroup(group: VitalGroup, summaryResults: GenericChildrenProps<TableData>) {
    const {location, organization, eventView, dataFilter} = this.props;
    const {vitals, colors, min, max, precision} = group;

    const bounds = vitals.reduce(
      (
        allBounds: Partial<
          Record<WebVital, {start: string | undefined; end: string | undefined}>
        >,
        vital: WebVital
      ) => {
        const slug = WEB_VITAL_DETAILS[vital].slug;
        allBounds[vital] = {
          start: decodeScalar(location.query[`${slug}Start`]),
          end: decodeScalar(location.query[`${slug}End`]),
        };
        return allBounds;
      },
      {}
    );

    return (
      <MeasurementsHistogramQuery
        location={location}
        orgSlug={organization.slug}
        eventView={eventView}
        numBuckets={NUM_BUCKETS}
        measurements={vitals.map(vital => WEB_VITAL_DETAILS[vital].slug)}
        min={min}
        max={max}
        precision={precision}
        dataFilter={dataFilter}
      >
        {multiHistogramResults => {
          const isLoading = summaryResults.isLoading || multiHistogramResults.isLoading;
          const error =
            summaryResults.error !== null || multiHistogramResults.error !== null;
          return (
            <React.Fragment>
              {vitals.map((vital, index) => {
                const details = WEB_VITAL_DETAILS[vital];
                const data = summaryResults.tableData?.data?.[0];

                const percentileAlias = getAggregateAlias(
                  `percentile(${vital}, ${PERCENTILE})`
                );
                const summary = (data?.[percentileAlias] ?? null) as number | null;

                const countAlias = getAggregateAlias(`count_at_least(${vital}, 0)`);
                const failedAlias = getAggregateAlias(
                  `count_at_least(${vital}, ${details.failureThreshold})`
                );
                const numerator = (data?.[failedAlias] ?? 0) as number;
                const denominator = (data?.[countAlias] ?? 0) as number;
                const failureRate = denominator <= 0 ? 0 : numerator / denominator;

                const {start, end} = bounds[vital] ?? {};

                return (
                  <React.Fragment key={vital}>
                    {this.renderVitalCard(
                      vital,
                      isLoading,
                      error,
                      summary,
                      failureRate,
                      multiHistogramResults.histograms?.[vital] ?? [],
                      [colors[index]],
                      start === undefined ? min : parseInt(start, 10),
                      end === undefined ? min : parseInt(end, 10),
                      precision
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
                <React.Fragment key={vitalGroup.vitals.join('')}>
                  {this.renderVitalGroup(vitalGroup, results)}
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
