import {browserHistory} from 'react-router';
import {Location} from 'history';
import omit from 'lodash/omit';

import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
  getDuration,
} from 'sentry/utils/formatters';
import {HistogramData} from 'sentry/utils/performance/histogram/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {AxisOption, getTermHelp, PERFORMANCE_TERM} from '../data';
import {Rectangle} from '../transactionSummary/transactionVitals/types';
import {platformToPerformanceType, PROJECT_PERFORMANCE_TYPE} from '../utils';

export const LEFT_AXIS_QUERY_KEY = 'left';
export const RIGHT_AXIS_QUERY_KEY = 'right';

type LandingDisplay = {
  field: LandingDisplayField;
  label: string;
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
    label: 'Web Vitals',
    field: LandingDisplayField.FRONTEND_PAGELOAD,
  },
  {
    label: 'Frontend',
    field: LandingDisplayField.FRONTEND_OTHER,
  },
  {
    label: 'Backend',
    field: LandingDisplayField.BACKEND,
  },
  {
    label: 'Mobile',
    field: LandingDisplayField.MOBILE,
  },
];

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

export function getLandingDisplayFromParam(location: Location) {
  const landingField = decodeScalar(location?.query?.landingDisplay);

  const display = LANDING_DISPLAYS.find(({field}) => field === landingField);
  return display;
}

export function getDefaultDisplayForPlatform(projects: Project[], eventView?: EventView) {
  const defaultDisplayField = getDefaultDisplayFieldForPlatform(projects, eventView);

  const defaultDisplay = LANDING_DISPLAYS.find(
    ({field}) => field === defaultDisplayField
  );
  return defaultDisplay || LANDING_DISPLAYS[0];
}

export function getCurrentLandingDisplay(
  location: Location,
  projects: Project[],
  eventView?: EventView
): LandingDisplay {
  const display = getLandingDisplayFromParam(location);
  if (display) {
    return display;
  }

  return getDefaultDisplayForPlatform(projects, eventView);
}

export function handleLandingDisplayChange(
  field: LandingDisplayField,
  location: Location,
  projects: Project[],
  organization: Organization,
  eventView?: EventView
) {
  // Transaction op can affect the display and show no results if it is explicitly set.
  const query = decodeScalar(location.query.query, '');
  const searchConditions = new MutableSearch(query);
  searchConditions.removeFilter('transaction.op');

  const queryWithConditions = {
    ...omit(location.query, ['landingDisplay', 'sort']),
    query: searchConditions.formatString(),
  };

  delete queryWithConditions[LEFT_AXIS_QUERY_KEY];
  delete queryWithConditions[RIGHT_AXIS_QUERY_KEY];

  const defaultDisplay = getDefaultDisplayFieldForPlatform(projects, eventView);
  const currentDisplay = getCurrentLandingDisplay(location, projects, eventView).field;

  const newQuery: {query: string; landingDisplay?: LandingDisplayField} =
    defaultDisplay === field
      ? {...queryWithConditions}
      : {...queryWithConditions, landingDisplay: field};

  trackAdvancedAnalyticsEvent('performance_views.landingv3.display_change', {
    organization,
    change_to_display: field,
    default_display: defaultDisplay,
    current_display: currentDisplay,
    is_default: defaultDisplay === currentDisplay,
  });

  browserHistory.push({
    pathname: location.pathname,
    query: newQuery,
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
