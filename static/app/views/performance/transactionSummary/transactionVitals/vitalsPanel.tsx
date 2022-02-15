import {Component, Fragment} from 'react';
import {Location} from 'history';

import {Panel} from 'sentry/components/panels';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import HistogramQuery from 'sentry/utils/performance/histogram/histogramQuery';
import {DataFilter, HistogramData} from 'sentry/utils/performance/histogram/types';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {VitalGroup} from 'sentry/utils/performance/vitals/types';
import {VitalData} from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';

import {NUM_BUCKETS, VITAL_GROUPS} from './constants';
import VitalCard from './vitalCard';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  results: object;
  dataFilter?: DataFilter;
};

class VitalsPanel extends Component<Props> {
  renderVitalCard(
    vital: WebVital,
    isLoading: boolean,
    error: boolean,
    data: VitalData | null,
    histogram: HistogramData,
    color: [string],
    min?: number,
    max?: number,
    precision?: number
  ) {
    const {location, organization, eventView, dataFilter} = this.props;
    const vitalDetails = WEB_VITAL_DETAILS[vital];

    const zoomed = min !== undefined || max !== undefined;

    return (
      <HistogramQuery
        location={location}
        orgSlug={organization.slug}
        eventView={eventView}
        numBuckets={NUM_BUCKETS}
        fields={zoomed ? [vital] : []}
        min={min}
        max={max}
        precision={precision}
        dataFilter={dataFilter}
      >
        {results => {
          const loading = zoomed ? results.isLoading : isLoading;
          const errored = zoomed ? results.error !== null : error;
          const chartData = zoomed ? results.histograms?.[vital] ?? histogram : histogram;
          return (
            <VitalCard
              location={location}
              isLoading={loading}
              error={errored}
              vital={vital}
              vitalDetails={vitalDetails}
              summaryData={data}
              chartData={chartData}
              colors={color}
              eventView={eventView}
              organization={organization}
              min={min}
              max={max}
              precision={precision}
              dataFilter={dataFilter}
            />
          );
        }}
      </HistogramQuery>
    );
  }

  renderVitalGroup(group: VitalGroup, summaryResults) {
    const {location, organization, eventView, dataFilter} = this.props;
    const {vitals, colors, min, max, precision} = group;

    const bounds = vitals.reduce(
      (
        allBounds: Partial<
          Record<WebVital, {end: string | undefined; start: string | undefined}>
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
      <HistogramQuery
        location={location}
        orgSlug={organization.slug}
        eventView={eventView}
        numBuckets={NUM_BUCKETS}
        fields={vitals}
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
            <Fragment>
              {vitals.map((vital, index) => {
                const data = summaryResults?.vitalsData?.[vital] ?? null;
                const histogram = multiHistogramResults.histograms?.[vital] ?? [];
                const {start, end} = bounds[vital] ?? {};

                return (
                  <Fragment key={vital}>
                    {this.renderVitalCard(
                      vital,
                      isLoading,
                      error,
                      data,
                      histogram,
                      [colors[index]],
                      parseBound(start, precision),
                      parseBound(end, precision),
                      precision
                    )}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        }}
      </HistogramQuery>
    );
  }

  render() {
    const {results} = this.props;

    return (
      <Panel>
        <Fragment>
          {VITAL_GROUPS.map(vitalGroup => (
            <Fragment key={vitalGroup.vitals.join('')}>
              {this.renderVitalGroup(vitalGroup, results)}
            </Fragment>
          ))}
        </Fragment>
      </Panel>
    );
  }
}

function parseBound(
  boundString: string | undefined,
  precision: number | undefined
): number | undefined {
  if (boundString === undefined) {
    return undefined;
  }
  if (precision === undefined || precision === 0) {
    return parseInt(boundString, 10);
  }
  return parseFloat(boundString);
}

export default VitalsPanel;
