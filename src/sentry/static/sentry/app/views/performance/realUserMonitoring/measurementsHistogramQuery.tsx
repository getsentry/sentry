import React from 'react';
import {Location} from 'history';
import omit from 'lodash/omit';

import {Client} from 'app/api';
import EventView, {isAPIPayloadSimilar} from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';

import {HistogramData} from './types';

type RawHistogramData = {
  key: string;
  bin: number;
  count: number;
};

type ChildrenProps = {
  isLoading: boolean;
  error: string | null;
  histograms: Record<string, HistogramData[]>;
};

type Props = {
  api: Client;
  location: Location;
  orgSlug: string;
  eventView: EventView;
  // these measurement names should NOT be prefixed with `measurements.`
  measurements: string[];
  numBuckets: number;
  children: (props: ChildrenProps) => React.ReactNode;
  min?: string;
  max?: string;
};

type State = {
  fetchId: symbol | null;
} & ChildrenProps;

class MeasurementsHistogramQuery extends React.Component<Props, State> {
  state: State = {
    isLoading: true,
    fetchId: null,
    error: null,
    histograms: {},
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    // Reload data if we aren't already loading,
    const refetchCondition = !this.state.isLoading && this.shouldRefetchData(prevProps);

    // or if we've moved from an invalid view state to a valid one,
    const eventViewValidation =
      !prevProps.eventView.isValid() && this.props.eventView.isValid();

    const minMaxChanged =
      prevProps.min !== this.props.min || prevProps.max !== this.props.max;

    if (refetchCondition || eventViewValidation || minMaxChanged) {
      this.fetchData();
    }
  }

  shouldRefetchData(prevProps: Props): boolean {
    const thisAPIPayload = this.props.eventView.getEventsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getEventsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  }

  fetchData = () => {
    const {eventView, location, orgSlug, measurements, numBuckets, min, max} = this.props;

    if (!eventView.isValid()) {
      return;
    }

    const url = `/organizations/${orgSlug}/events-measurements-histogram/`;
    const fetchId = Symbol('fetchId');

    const baseApiPayload = {
      measurement: measurements,
      num_buckets: numBuckets,
      min,
      max,
    };
    const additionalApiPayload = omit(eventView.getEventsAPIPayload(location), [
      'field',
      'sort',
      'per_page',
    ]);
    const apiPayload = Object.assign(baseApiPayload, additionalApiPayload);

    this.setState({isLoading: true, fetchId});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          ...apiPayload,
        },
      })
      .then(
        ([data, _status, _jqXHR]) => {
          if (this.state.fetchId !== fetchId) {
            return;
          }

          this.setState({
            isLoading: false,
            fetchId: null,
            error: null,
            histograms: this.formatData(data.data),
          });
        },
        err => {
          this.setState({
            isLoading: false,
            fetchId: null,
            error: err?.responseJSON?.detail ?? null,
            histograms: {},
          });
        }
      );
  };

  formatData(data: RawHistogramData[]): Record<string, HistogramData[]> {
    const {measurements} = this.props;

    const histogramData = measurements.reduce((record, measurement) => {
      record[`measurements.${measurement}`] = [];
      return record;
    }, {});

    data.forEach(row => {
      histogramData[`measurements.${row.key}`].push({
        histogram: row.bin,
        count: row.count,
      });
    });

    return histogramData;
  }

  render() {
    const {children} = this.props;
    const {isLoading, error, histograms} = this.state;

    return children({
      isLoading,
      error,
      histograms,
    });
  }
}

export default withApi(MeasurementsHistogramQuery);
