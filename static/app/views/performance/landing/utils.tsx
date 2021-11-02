import {ReactText} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
  getDuration,
} from 'app/utils/formatters';
import {HistogramData} from 'app/utils/performance/histogram/types';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';

import {AxisOption, getTermHelp, PERFORMANCE_TERM} from '../data';
import {Rectangle} from '../transactionSummary/transactionVitals/types';
import {platformToPerformanceType, PROJECT_PERFORMANCE_TYPE} from '../utils';

export const LEFT_AXIS_QUERY_KEY = 'left';
export const RIGHT_AXIS_QUERY_KEY = 'right';

type LandingDisplay = {
  label: string;
  field: LandingDisplayField;
};

export enum LandingDisplayField {
  ALL = 'all',
  FRONTEND_PAGELOAD = 'frontend_pageload',
  FRONTEND_OTHER = 'frontend_other',
  BACKEND = 'backend',
  MOBILE = 'mobile',
}

export const LANDING_DISPLAYS = [
  {
    label: 'All Transactions',
    field: LandingDisplayField.ALL,
  },
  {
    label: 'Frontend (Pageload)',
    field: LandingDisplayField.FRONTEND_PAGELOAD,
  },
  {
    label: 'Frontend (Other)',
    field: LandingDisplayField.FRONTEND_OTHER,
  },
  {
    label: 'Backend',
    field: LandingDisplayField.BACKEND,
  },
  {
    label: 'Mobile',
    field: LandingDisplayField.MOBILE,
    isShown: (organization: Organization) =>
      organization.features.includes('performance-mobile-vitals'),
  },
];

export function excludeTransaction(
  transaction: string | ReactText,
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

export function getCurrentLandingDisplay(
  location: Location,
  projects: Project[],
  eventView?: EventView
): LandingDisplay {
  const landingField = decodeScalar(location?.query?.landingDisplay);
  const display = LANDING_DISPLAYS.find(({field}) => field === landingField);
  if (display) {
    return display;
  }

  const defaultDisplayField = getDefaultDisplayFieldForPlatform(projects, eventView);
  const defaultDisplay = LANDING_DISPLAYS.find(
    ({field}) => field === defaultDisplayField
  );
  return defaultDisplay || LANDING_DISPLAYS[0];
}

export function handleLandingDisplayChange(field: string, location: Location) {
  const newQuery = {...location.query};

  delete newQuery[LEFT_AXIS_QUERY_KEY];
  delete newQuery[RIGHT_AXIS_QUERY_KEY];

  // Transaction op can affect the display and show no results if it is explicitly set.
  const query = decodeScalar(location.query.query, '');
  const searchConditions = new MutableSearch(query);
  searchConditions.removeFilter('transaction.op');

  browserHistory.push({
    pathname: location.pathname,
    query: {
      ...newQuery,
      query: searchConditions.formatString(),
      landingDisplay: field,
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

export function getDefaultDisplayFieldForPlatform(
  projects: Project[],
  eventView?: EventView
) {
  if (!eventView) {
    return LandingDisplayField.ALL;
  }
  const projectIds = eventView.project;

  const performanceTypeToDisplay = {
    [PROJECT_PERFORMANCE_TYPE.ANY]: LandingDisplayField.ALL,
    [PROJECT_PERFORMANCE_TYPE.FRONTEND]: LandingDisplayField.FRONTEND_PAGELOAD,
    [PROJECT_PERFORMANCE_TYPE.BACKEND]: LandingDisplayField.BACKEND,
    [PROJECT_PERFORMANCE_TYPE.MOBILE]: LandingDisplayField.MOBILE,
  };
  const performanceType = platformToPerformanceType(projects, projectIds);
  const landingField =
    performanceTypeToDisplay[performanceType] ?? LandingDisplayField.ALL;
  return landingField;
}

type VitalCardDetail = {
  title: string;
  tooltip: string;
  formatter: (value: number) => string | number;
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
      tooltip: getTermHelp(organization, PERFORMANCE_TERM.APDEX_NEW),
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
