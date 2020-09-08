import React from 'react';
import {Location} from 'history';

import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';

import {NUM_BUCKETS} from './constants';
import {HistogramData} from './types';

type ChildrenProps = {
  isLoading: boolean;
  errors: string[];
  histogram: Partial<Record<string, HistogramData[]>>;
};

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  measures: string[];
  // TODO(tonyx): remove the min/max this is just for populating test data
  min: number;
  max: number;
  children: (props: ChildrenProps) => React.ReactNode;
};

/**
 * This class is a stub for the measurements data. It simply generates some
 * random data for the time being. It should be replaced with queries that
 * retrieve the true data from the backend.
 */
class MeasuresQuery extends React.Component<Props> {
  getHistograms(_x) {
    const {measures} = this.props;
    const {min, max} = this.props;

    return measures.reduce((histogram, measure) => {
      histogram[measure] = Array(NUM_BUCKETS)
        .fill(null)
        .map((_, i) => ({
          histogram: i * ((max - min) / NUM_BUCKETS),
          count: Math.floor(Math.random() * 100),
        }));
      return histogram;
    }, {});
  }

  render() {
    const {children} = this.props;

    const histogramResults = null;

    return children({
      isLoading: false,
      errors: [],
      histogram: this.getHistograms(histogramResults),
    });
  }
}

export default MeasuresQuery;
