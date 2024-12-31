import type {Location} from 'history';

import type {SelectValue} from 'sentry/types/core';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';

import {FILTER_OPTIONS} from './constants';
import type {DataFilter} from './types';

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

function Histogram(props: Props) {
  const {location, zoomKeys, children} = props;
  const navigate = useNavigate();

  const isZoomed = () => {
    return zoomKeys.map(key => location.query[key]).some(value => value !== undefined);
  };

  const handleResetView = () => {
    navigate({
      pathname: location.pathname,
      query: removeHistogramQueryStrings(location, zoomKeys),
    });
  };

  const getActiveFilter = () => {
    const dataFilter = location.query.dataFilter
      ? decodeScalar(location.query.dataFilter)
      : FILTER_OPTIONS[0].value;
    return FILTER_OPTIONS.find(item => item.value === dataFilter) || FILTER_OPTIONS[0];
  };

  const handleFilterChange = (value: string) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...removeHistogramQueryStrings(location, zoomKeys),
        dataFilter: value,
      },
    });
  };

  const childrenProps = {
    isZoomed: isZoomed(),
    handleResetView,
    activeFilter: getActiveFilter(),
    handleFilterChange,
    filterOptions: FILTER_OPTIONS,
  };
  return children(childrenProps);
}

export function removeHistogramQueryStrings(location: Location, zoomKeys: string[]) {
  const query: Location['query'] = {...location.query, cursor: undefined};

  delete query.dataFilter;
  // reset all zoom parameters
  zoomKeys.forEach(key => delete query[key]);

  return query;
}

export default Histogram;
