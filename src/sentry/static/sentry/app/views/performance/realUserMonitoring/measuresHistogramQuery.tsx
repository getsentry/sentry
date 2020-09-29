import React from 'react';
import {Location} from 'history';
import omit from 'lodash/omit';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';

import {HistogramData} from './types';

type RawHistogramData = {
  histogram_key: string;
  histogram_bin: number;
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
  organization: Organization;
  eventView: EventView;
  measurements: string[];
  numBuckets: number;
  children: (props: ChildrenProps) => React.ReactNode;
};

type State = {
  fetchId: symbol | null;
} & ChildrenProps;

/**
 * This class is a stub for the measurements data. It simply generates some
 * random data for the time being. It should be replaced with queries that
 * retrieve the true data from the backend.
 */
class MeasuresQuery extends React.Component<Props, State> {
  state: State = {
    isLoading: true,
    fetchId: null,
    error: null,
    histograms: {},
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData = () => {
    const {eventView, location, organization, measurements, numBuckets} = this.props;

    if (!eventView.isValid()) {
      return;
    }

    const url = `/organizations/${organization.slug}/events-measurements-histogram/`;
    const fetchId = Symbol('fetchId');

    const baseApiPayload = omit(eventView.getEventsAPIPayload(location), [
      'field',
      'sort',
      'per_page',
    ]);
    const apiPayload = Object.assign(
      {measurement: measurements, numBuckets},
      baseApiPayload
    );

    this.setState({isLoading: true, fetchId});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          ...apiPayload,
        },
      })
      .then(([data, _status, _jqXHR]) => {
        if (this.state.fetchId !== fetchId) {
          return;
        }

        this.setState({
          isLoading: false,
          fetchId: null,
          error: null,
          histograms: this.formatData(data.data),
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          fetchId: null,
          error: err?.responseJSON?.detail ?? null,
          histograms: {},
        });
      });
  };

  formatData(data: RawHistogramData[]): Record<string, HistogramData[]> {
    const {measurements} = this.props;

    const histogramData = measurements.reduce((record, measurement) => {
      record[`measurements.${measurement}`] = [];
      return record;
    }, {});

    data.forEach(row => {
      histogramData[`measurements.${row.histogram_key}`].push({
        histogram: row.histogram_bin,
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

export default withApi(MeasuresQuery);
