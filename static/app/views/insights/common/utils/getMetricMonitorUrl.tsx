import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {parseEventTypesFromQuery} from 'sentry/views/detectors/datasetConfig/eventTypes';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';

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

const DEFAULT_EAP_EVENT_TYPES = [EventTypes.TRACE_ITEM_SPAN];

function getEapEventTypesFromQuery(query: string): EventTypes[] {
  const parsed = parseEventTypesFromQuery(query, DEFAULT_EAP_EVENT_TYPES);
  return parsed.eventTypes;
}

export function getMetricMonitorUrl({
  aggregate,
  dataset,
  organization,
  project,
  name,
  environment,
  query,
  referrer,
  eventTypes: incomingEventTypes,
}: Params) {
  let detectorDataset = getDetectorDataset(dataset, []);
  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    const eventTypes = incomingEventTypes ?? getEapEventTypesFromQuery(query ?? '');
    detectorDataset = getDetectorDataset(dataset, eventTypes);
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
    pathname: `${makeMonitorCreatePathname(organization.slug)}settings`,
    query: queryParams,
  };
}
