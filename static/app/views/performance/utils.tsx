import {browserHistory} from 'react-router';
import {Location, LocationDescriptor, Query} from 'history';

import Duration from 'app/components/duration';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {backend, frontend, mobile} from 'app/data/platformCategories';
import {GlobalSelection, Organization, OrganizationSummary, Project} from 'app/types';
import {defined} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {statsPeriodToDays} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {TRACING_FIELDS} from 'app/utils/discover/fields';
import {getDuration} from 'app/utils/formatters';
import getCurrentSentryReactTransaction from 'app/utils/getCurrentSentryReactTransaction';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';

import {DEFAULT_MAX_DURATION} from './trends/utils';

/**
 * Performance type can used to determine a default view or which specific field should be used by default on pages
 * where we don't want to wait for transaction data to return to determine how to display aspects of a page.
 */
export enum PROJECT_PERFORMANCE_TYPE {
  ANY = 'any', // Fallback to transaction duration
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  FRONTEND_OTHER = 'frontend_other',
  MOBILE = 'mobile',
}

const FRONTEND_PLATFORMS: string[] = [...frontend];
const BACKEND_PLATFORMS: string[] = [...backend];
const MOBILE_PLATFORMS: string[] = [...mobile];

export function platformToPerformanceType(
  projects: Project[],
  projectIds: readonly number[]
) {
  if (projectIds.length === 0 || projectIds[0] === ALL_ACCESS_PROJECTS) {
    return PROJECT_PERFORMANCE_TYPE.ANY;
  }
  const selectedProjects = projects.filter(p => projectIds.includes(parseInt(p.id, 10)));
  if (selectedProjects.length === 0 || selectedProjects.some(p => !p.platform)) {
    return PROJECT_PERFORMANCE_TYPE.ANY;
  }

  if (
    selectedProjects.every(project =>
      FRONTEND_PLATFORMS.includes(project.platform as string)
    )
  ) {
    return PROJECT_PERFORMANCE_TYPE.FRONTEND;
  }

  if (
    selectedProjects.every(project =>
      BACKEND_PLATFORMS.includes(project.platform as string)
    )
  ) {
    return PROJECT_PERFORMANCE_TYPE.BACKEND;
  }

  if (
    selectedProjects.every(project =>
      MOBILE_PLATFORMS.includes(project.platform as string)
    )
  ) {
    return PROJECT_PERFORMANCE_TYPE.MOBILE;
  }

  return PROJECT_PERFORMANCE_TYPE.ANY;
}

/**
 * Used for transaction summary to determine appropriate columns on a page, since there is no display field set for the page.
 */
export function platformAndConditionsToPerformanceType(
  projects: Project[],
  eventView: EventView
) {
  const performanceType = platformToPerformanceType(projects, eventView.project);
  if (performanceType === PROJECT_PERFORMANCE_TYPE.FRONTEND) {
    const conditions = new MutableSearch(eventView.query);
    const ops = conditions.getFilterValues('!transaction.op');
    if (ops.some(op => op === 'pageload')) {
      return PROJECT_PERFORMANCE_TYPE.FRONTEND_OTHER;
    }
  }
  return performanceType;
}

/**
 * Used for transaction summary to check the view itself, since it can have conditions which would exclude it from having vitals aside from platform.
 */
export function isSummaryViewFrontendPageLoad(eventView: EventView, projects: Project[]) {
  return (
    platformAndConditionsToPerformanceType(projects, eventView) ===
    PROJECT_PERFORMANCE_TYPE.FRONTEND
  );
}

export function isSummaryViewFrontend(eventView: EventView, projects: Project[]) {
  return (
    platformAndConditionsToPerformanceType(projects, eventView) ===
      PROJECT_PERFORMANCE_TYPE.FRONTEND ||
    platformAndConditionsToPerformanceType(projects, eventView) ===
      PROJECT_PERFORMANCE_TYPE.FRONTEND_OTHER
  );
}

export function getPerformanceLandingUrl(organization: OrganizationSummary): string {
  return `/organizations/${organization.slug}/performance/`;
}

export function getPerformanceTrendsUrl(organization: OrganizationSummary): string {
  return `/organizations/${organization.slug}/performance/trends/`;
}

export function getTransactionSearchQuery(location: Location, query: string = '') {
  return decodeScalar(location.query.query, query).trim();
}

export function handleTrendsClick({
  location,
  organization,
}: {
  location: Location;
  organization: Organization;
}) {
  trackAnalyticsEvent({
    eventKey: 'performance_views.change_view',
    eventName: 'Performance Views: Change View',
    organization_id: parseInt(organization.id, 10),
    view_name: 'TRENDS',
  });

  const target = trendsTargetRoute({location, organization});

  browserHistory.push(target);
}

export function trendsTargetRoute({
  location,
  organization,
  initialConditions,
  additionalQuery,
}: {
  location: Location;
  organization: Organization;
  initialConditions?: MutableSearch;
  additionalQuery?: {[x: string]: string};
}) {
  const newQuery = {
    ...location.query,
    ...additionalQuery,
  };

  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  const modifiedConditions = initialConditions ?? new MutableSearch([]);

  if (conditions.hasFilter('tpm()')) {
    modifiedConditions.setFilterValues('tpm()', conditions.getFilterValues('tpm()'));
  } else {
    modifiedConditions.setFilterValues('tpm()', ['>0.01']);
  }
  if (conditions.hasFilter('transaction.duration')) {
    modifiedConditions.setFilterValues(
      'transaction.duration',
      conditions.getFilterValues('transaction.duration')
    );
  } else {
    modifiedConditions.setFilterValues('transaction.duration', [
      '>0',
      `<${DEFAULT_MAX_DURATION}`,
    ]);
  }
  newQuery.query = modifiedConditions.formatString();

  return {pathname: getPerformanceTrendsUrl(organization), query: {...newQuery}};
}

export function removeTracingKeysFromSearch(
  currentFilter: MutableSearch,
  options: {excludeTagKeys: Set<string>} = {
    excludeTagKeys: new Set([
      // event type can be "transaction" but we're searching for issues
      'event.type',
      // the project is already determined by the transaction,
      // and issue search does not support the project filter
      'project',
    ]),
  }
) {
  currentFilter.getFilterKeys().forEach(tagKey => {
    const searchKey = tagKey.startsWith('!') ? tagKey.substr(1) : tagKey;
    // Remove aggregates and transaction event fields
    if (
      // aggregates
      searchKey.match(/\w+\(.*\)/) ||
      // transaction event fields
      TRACING_FIELDS.includes(searchKey) ||
      // tags that we don't want to pass to pass to issue search
      options.excludeTagKeys.has(searchKey)
    ) {
      currentFilter.removeFilter(tagKey);
    }
  });

  return currentFilter;
}

export function getTransactionDetailsUrl(
  organization: OrganizationSummary,
  eventSlug: string,
  transaction: string,
  query: Query,
  hash?: string
): LocationDescriptor {
  const target = {
    pathname: `/organizations/${organization.slug}/performance/${eventSlug}/`,
    query: {
      ...query,
      transaction,
    },
    hash,
  };
  if (!defined(hash)) {
    delete target.hash;
  }
  return target;
}

export function getTransactionComparisonUrl({
  organization,
  baselineEventSlug,
  regressionEventSlug,
  transaction,
  query,
}: {
  organization: OrganizationSummary;
  baselineEventSlug: string;
  regressionEventSlug: string;
  transaction: string;
  query: Query;
}): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/performance/compare/${baselineEventSlug}/${regressionEventSlug}/`,
    query: {
      ...query,
      transaction,
    },
  };
}

export function addRoutePerformanceContext(selection: GlobalSelection) {
  const transaction = getCurrentSentryReactTransaction();
  const days = statsPeriodToDays(
    selection.datetime.period,
    selection.datetime.start,
    selection.datetime.end
  );
  const oneDay = 86400;
  const seconds = Math.floor(days * oneDay);

  transaction?.setTag('query.period', seconds.toString());
  let groupedPeriod = '>30d';
  if (seconds <= oneDay) groupedPeriod = '<=1d';
  else if (seconds <= oneDay * 7) groupedPeriod = '<=7d';
  else if (seconds <= oneDay * 14) groupedPeriod = '<=14d';
  else if (seconds <= oneDay * 30) groupedPeriod = '<=30d';
  transaction?.setTag('query.period.grouped', groupedPeriod);
}

export function getTransactionName(location: Location): string | undefined {
  const {transaction} = location.query;

  return decodeScalar(transaction);
}

type DurationProps = {abbreviation?: boolean};
type SecondsProps = {seconds: number} & DurationProps;
type MillisecondsProps = {milliseconds: number} & DurationProps;
type PerformanceDurationProps = SecondsProps | MillisecondsProps;
const hasMilliseconds = (props: PerformanceDurationProps): props is MillisecondsProps => {
  return defined((props as MillisecondsProps).milliseconds);
};
export function PerformanceDuration(props: SecondsProps);
export function PerformanceDuration(props: MillisecondsProps);
export function PerformanceDuration(props: PerformanceDurationProps) {
  const normalizedSeconds = hasMilliseconds(props)
    ? props.milliseconds / 1000
    : props.seconds;
  return (
    <Duration
      abbreviation={props.abbreviation}
      seconds={normalizedSeconds}
      fixedDigits={2}
    />
  );
}

export function getPerformanceDuration(milliseconds: number) {
  return getDuration(milliseconds / 1000, milliseconds > 1000 ? 2 : 0, true);
}
