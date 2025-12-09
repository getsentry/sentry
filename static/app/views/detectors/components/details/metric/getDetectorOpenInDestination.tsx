import type {LocationDescriptor} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {SnubaQuery} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {getAggregateAlias, parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {DEFAULT_PROJECT_THRESHOLD} from 'sentry/views/performance/data';

interface GetDetectorDestinationOptions {
  organization: Organization;
  projectId: string | number;
  snubaQuery: SnubaQuery;
  detectorName?: string | null;
  end?: string | null;
  start?: string | null;
  statsPeriod?: string | null;
}

interface OpenInDestination {
  buttonText: string;
  to: LocationDescriptor;
}

function convertTimeWindowSecondsToInterval(timeWindowSeconds: number): string {
  if (timeWindowSeconds >= 3600) {
    return `${Math.floor(timeWindowSeconds / 3600)}h`;
  }
  return `${Math.floor(timeWindowSeconds / 60)}m`;
}

function getDetectorDiscoverUrl({
  detectorName,
  organization,
  projectId,
  snubaQuery,
  statsPeriod,
  start,
  end,
}: GetDetectorDestinationOptions): LocationDescriptor {
  const numericProjectId = Number(projectId);
  const datasetConfig = getDatasetConfig(
    getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes)
  );

  const aggregateAlias = getAggregateAlias(snubaQuery.aggregate);

  const timePeriodFields =
    statsPeriod && !start && !end
      ? {range: statsPeriod}
      : {start: start ?? undefined, end: end ?? undefined};

  const fields =
    snubaQuery.dataset === Dataset.ERRORS
      ? ['issue', 'count()', 'count_unique(user)']
      : [
          'transaction',
          'project',
          snubaQuery.aggregate,
          'count_unique(user)',
          `user_misery(${DEFAULT_PROJECT_THRESHOLD})`,
        ];

  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: detectorName || 'Transactions',
    dataset:
      snubaQuery.dataset === Dataset.ERRORS
        ? DiscoverDatasets.ERRORS
        : DiscoverDatasets.TRANSACTIONS,
    fields,
    orderby: `-${aggregateAlias}`,
    query: datasetConfig.toSnubaQueryString(snubaQuery),
    version: 2,
    projects: [numericProjectId],
    environment: snubaQuery.environment ? [snubaQuery.environment] : undefined,
    ...timePeriodFields,
  });

  if (!eventView) {
    return '';
  }

  const {query, ...toObject} = eventView.getResultsViewUrlTarget(organization, false);
  const timeWindowString = convertTimeWindowSecondsToInterval(snubaQuery.timeWindow);

  return normalizeUrl({
    query: {...query, interval: timeWindowString},
    ...toObject,
  });
}

function getDetectorExploreUrl({
  organization,
  projectId,
  snubaQuery,
  statsPeriod,
  start,
  end,
}: GetDetectorDestinationOptions): string {
  const interval = convertTimeWindowSecondsToInterval(snubaQuery.timeWindow);
  const numericProjectId = Number(projectId);
  const dataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);

  const query =
    dataset === DetectorDataset.TRANSACTIONS
      ? `is_transaction:true ${snubaQuery.query}`.trim()
      : snubaQuery.query;

  return getExploreUrl({
    organization,
    selection: {
      datetime: {
        period: statsPeriod ?? null,
        start: statsPeriod ? null : (start ?? null),
        end: statsPeriod ? null : (end ?? null),
        utc: null,
      },
      environments: snubaQuery.environment ? [snubaQuery.environment] : [],
      projects: [numericProjectId],
    },
    interval,
    visualize: [
      {
        chartType: ChartType.LINE,
        yAxes: [snubaQuery.aggregate],
      },
    ],
    query,
  });
}

function getDetectorLogsUrl({
  organization,
  projectId,
  snubaQuery,
  statsPeriod,
  start,
  end,
}: GetDetectorDestinationOptions): string {
  const parsed = snubaQuery.aggregate ? parseFunction(snubaQuery.aggregate) : null;

  return getLogsUrl({
    organization,
    selection: {
      datetime: {
        period: statsPeriod ?? null,
        start: start ?? null,
        end: end ?? null,
        utc: null,
      },
      environments: snubaQuery.environment ? [snubaQuery.environment] : [],
      projects: [Number(projectId)],
    },
    query: snubaQuery.query,
    aggregateFn: parsed?.name,
    aggregateParam: parsed?.arguments[0],
  });
}

/**
 * Get the "Open in" button text and destination URL for a metric detector.
 *
 * Returns the appropriate destination based on the detector's dataset:
 * - SPANS/TRANSACTIONS: Open in Explore
 * - LOGS: Open in Logs
 * - ERRORS: Open in Discover
 */
export function getDetectorOpenInDestination(
  options: GetDetectorDestinationOptions
): OpenInDestination | null {
  const {snubaQuery} = options;

  if (!defined(snubaQuery)) {
    return null;
  }

  const dataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);

  switch (dataset) {
    case DetectorDataset.LOGS:
      return {
        buttonText: t('Open in Logs'),
        to: getDetectorLogsUrl(options),
      };
    case DetectorDataset.SPANS:
      return {
        buttonText: t('Open in Explore'),
        to: getDetectorExploreUrl(options),
      };
    case DetectorDataset.TRANSACTIONS:
      return {
        buttonText: t('Open in Explore'),
        to: getDetectorExploreUrl(options),
      };
    case DetectorDataset.ERRORS:
      return {
        buttonText: t('Open in Discover'),
        to: getDetectorDiscoverUrl(options),
      };
    case DetectorDataset.RELEASES:
      // Releases/crash-free alerts don't have a corresponding explore view
      return null;
    default:
      return null;
  }
}
