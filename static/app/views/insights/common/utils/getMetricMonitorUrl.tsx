import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {parseEventTypesFromQuery} from 'sentry/views/detectors/datasetConfig/eventTypes';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

type Params = {
  aggregate: string;
  dataset: Dataset;
  organization: Organization;
  project: Project | undefined;
  environment?: string | string[] | null;
  eventTypes?: EventTypes[];
  name?: string;
  query?: string;
  referrer?: string;
};

export function getMetricMonitorUrl({
  aggregate,
  dataset,
  organization,
  project,
  name,
  environment,
  query,
  referrer,
  eventTypes,
}: Params) {
  let detectorDataset = getDetectorDataset(dataset, []);
  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    const defaultTypes: EventTypes[] = [EventTypes.TRACE_ITEM_SPAN];
    const parsed = parseEventTypesFromQuery(query ?? '', defaultTypes);
    const typesToUse =
      eventTypes && eventTypes.length > 0 ? eventTypes : parsed.eventTypes;
    detectorDataset = getDetectorDataset(dataset, typesToUse);
  }
  const queryParams = {
    detectorType: 'metric_issue',
    project: project?.id,
    dataset: detectorDataset,
    aggregate,
    environment: Array.isArray(environment) ? environment[0] : environment,
    query,
    name,
    referrer,
  } as const;

  return {
    pathname: `${makeMonitorBasePathname(organization.slug)}new/settings/`,
    query: queryParams,
  };
}
