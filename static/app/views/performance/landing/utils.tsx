import type {Location} from 'history';
import omit from 'lodash/omit';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  platformToPerformanceType,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

const LEFT_AXIS_QUERY_KEY = 'left';
const RIGHT_AXIS_QUERY_KEY = 'right';

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

// TODO Abdullah Khan: Remove code for Web Vitals tab in performance landing
// page when new starfish web vitals module is mature.
export const LANDING_DISPLAYS = [
  {
    label: t('All Transactions'),
    field: LandingDisplayField.ALL,
  },
  {
    label: t('Frontend'),
    field: LandingDisplayField.FRONTEND_OTHER,
  },
  {
    label: t('Backend'),
    field: LandingDisplayField.BACKEND,
  },
  {
    label: t('Mobile'),
    field: LandingDisplayField.MOBILE,
  },
];

export function excludeTransaction(
  transaction: string | string | number,
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
  return defaultDisplay || LANDING_DISPLAYS[0]!;
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

  const queryWithConditions: Record<string, string> & {query: string} = {
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

  trackAnalytics('performance_views.landingv3.display_change', {
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

function getDefaultDisplayFieldForPlatform(projects: Project[], eventView?: EventView) {
  if (!eventView) {
    return LandingDisplayField.ALL;
  }
  const projectIds = eventView.project;

  const performanceTypeToDisplay = {
    [ProjectPerformanceType.ANY]: LandingDisplayField.ALL,
    [ProjectPerformanceType.FRONTEND]: LandingDisplayField.FRONTEND_OTHER,
    [ProjectPerformanceType.BACKEND]: LandingDisplayField.BACKEND,
    [ProjectPerformanceType.MOBILE]: LandingDisplayField.MOBILE,
  };
  const performanceType = platformToPerformanceType(projects, projectIds);
  const landingField =
    performanceTypeToDisplay[performanceType as keyof typeof performanceTypeToDisplay] ??
    LandingDisplayField.ALL;
  return landingField;
}

export function checkIsReactNative(eventView: EventView) {
  // only react native should contain the stall percentage column
  return eventView
    .getFields()
    .some(field => field.includes('measurements.stall_percentage'));
}
