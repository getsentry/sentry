import {browserHistory} from 'react-router';
import {Location} from 'history';

import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
  getDuration,
} from 'sentry/utils/formatters';
import {HistogramData} from 'sentry/utils/performance/histogram/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {Rectangle} from '../../performance/transactionSummary/transactionVitals/types';
import {AxisOption, getTermHelp, PERFORMANCE_TERM} from '../data';

export const LEFT_AXIS_QUERY_KEY = 'left';
export const RIGHT_AXIS_QUERY_KEY = 'right';

export function excludeTransaction(
  transaction: string | React.ReactText,
  props: {eventView: EventView; location: Location}
) {
  const {eventView, location} = props;

  const searchConditions = new MutableSearch(eventView.query);
  searchConditions.addFilterValues('!transaction', [`${transaction}`]);

  browserHistory.push({
    pathname: location.pathname,
    query: {
      ...location.query,
      cursor: undefined,
      query: searchConditions.formatString(),
    },
  });
}

export function getChartWidth(chartData: HistogramData, refPixelRect: Rectangle | null) {
  const distance = refPixelRect ? refPixelRect.point2.x - refPixelRect.point1.x : 0;
  const chartWidth = chartData.length * distance;

  return {
    chartWidth,
  };
}

type VitalCardDetail = {
  formatter: (value: number) => string | number;
  title: string;
  tooltip: string;
};

export const vitalCardDetails = (
  organization: Organization
): {[key: string]: VitalCardDetail | undefined} => {
  return {
    'p75(transaction.duration)': {
      title: t('Duration (p75)'),
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.P75),
      formatter: value => getDuration(value / 1000, value >= 1000 ? 3 : 0, true),
    },
    'tpm()': {
      title: t('Throughput'),
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.THROUGHPUT),
      formatter: formatAbbreviatedNumber,
    },
    'failure_rate()': {
      title: t('Failure Rate'),
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.FAILURE_RATE),
      formatter: value => formatPercentage(value, 2),
    },
    'apdex()': {
      title: t('Apdex'),
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX),
      formatter: value => formatFloat(value, 4),
    },
    'p75(measurements.frames_slow_rate)': {
      title: t('Slow Frames (p75)'),
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.SLOW_FRAMES),
      formatter: value => formatPercentage(value, 2),
    },
    'p75(measurements.frames_frozen_rate)': {
      title: t('Frozen Frames (p75)'),
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.FROZEN_FRAMES),
      formatter: value => formatPercentage(value, 2),
    },
    'p75(measurements.app_start_cold)': {
      title: t('Cold Start (p75)'),
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_COLD),
      formatter: value => getDuration(value / 1000, value >= 1000 ? 3 : 0, true),
    },
    'p75(measurements.app_start_warm)': {
      title: t('Warm Start (p75)'),
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APP_START_WARM),
      formatter: value => getDuration(value / 1000, value >= 1000 ? 3 : 0, true),
    },
    'p75(measurements.stall_percentage)': {
      title: t('Stall Percentage (p75)'),
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.STALL_PERCENTAGE),
      formatter: value => formatPercentage(value, 2),
    },
  };
};

export function getDisplayAxes(options: AxisOption[], location: Location) {
  const leftDefault = options.find(opt => opt.isLeftDefault) || options[0];
  const rightDefault = options.find(opt => opt.isRightDefault) || options[1];

  const leftAxis =
    options.find(opt => opt.value === location.query[LEFT_AXIS_QUERY_KEY]) || leftDefault;
  const rightAxis =
    options.find(opt => opt.value === location.query[RIGHT_AXIS_QUERY_KEY]) ||
    rightDefault;
  return {
    leftAxis,
    rightAxis,
  };
}

export function checkIsReactNative(eventView) {
  // only react native should contain the stall percentage column
  return Boolean(
    eventView.getFields().find(field => field.includes('measurements.stall_percentage'))
  );
}
