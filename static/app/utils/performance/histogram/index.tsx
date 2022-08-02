import {Component} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {SelectValue} from 'sentry/types';
import {decodeScalar} from 'sentry/utils/queryString';

import {FILTER_OPTIONS} from './constants';
import {DataFilter} from './types';

type HistogramChildrenProps = {
  activeFilter: SelectValue<DataFilter>;
  filterOptions: typeof FILTER_OPTIONS;
  handleFilterChange: (option: string) => void;
  handleResetView: () => void;
  isZoomed: boolean;
};

type Props = {
  children: (props: HistogramChildrenProps) => React.ReactNode;
  location: Location;
  zoomKeys: string[];
};

class Histogram extends Component<Props> {
  isZoomed() {
    const {location, zoomKeys} = this.props;
    return zoomKeys.map(key => location.query[key]).some(value => value !== undefined);
  }

  handleResetView = () => {
    const {location, zoomKeys} = this.props;

    browserHistory.push({
      pathname: location.pathname,
      query: removeHistogramQueryStrings(location, zoomKeys),
    });
  };

  getActiveFilter() {
    const {location} = this.props;

    const dataFilter = location.query.dataFilter
      ? decodeScalar(location.query.dataFilter)
      : FILTER_OPTIONS[0].value;
    return FILTER_OPTIONS.find(item => item.value === dataFilter) || FILTER_OPTIONS[0];
  }

  handleFilterChange = (value: string) => {
    const {location, zoomKeys} = this.props;

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...removeHistogramQueryStrings(location, zoomKeys),
        dataFilter: value,
      },
    });
  };

  render() {
    const childrenProps = {
      isZoomed: this.isZoomed(),
      handleResetView: this.handleResetView,
      activeFilter: this.getActiveFilter(),
      handleFilterChange: this.handleFilterChange,
      filterOptions: FILTER_OPTIONS,
    };
    return this.props.children(childrenProps);
  }
}

export function removeHistogramQueryStrings(location: Location, zoomKeys: string[]) {
  const query: Location['query'] = {...location.query, cursor: undefined};

  delete query.dataFilter;
  // reset all zoom parameters
  zoomKeys.forEach(key => delete query[key]);

  return query;
}

export default Histogram;
