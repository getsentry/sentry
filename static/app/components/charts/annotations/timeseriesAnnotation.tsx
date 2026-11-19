type TimeseriesAnnotationType =
  | 'inbound_filter_change'
  | 'infrastructure_change'
  | 'sdk_update'
  | 'sentry_outage'
  | 'custom';

type TimeseriesAnnotationScope =
  | 'global'
  | 'spans'
  | 'logs'
  | 'tracemetrics'
  | 'errors'
  | 'occurrences';

type TimeseriesAnnotationSeverity = 'low' | 'medium' | 'high';

/**
 * An external event that could explain a change in telemetry data, as
 * returned by `/organizations/{org}/annotations/`.
 */
export interface TimeseriesAnnotation {
  annotationType: TimeseriesAnnotationType;
  createdBy: {id: string; type: 'user' | 'service_account'} | null;
  createdByLabel: string | null;
  dateAdded: string;
  dateUpdated: string;
  description: string;
  endTimestamp: string | null;
  environment: string | null;
  id: string;
  intervalType: 'point' | 'range';
  organizationId: string;
  projectId: string | null;
  scope: TimeseriesAnnotationScope;
  severity: TimeseriesAnnotationSeverity;
  startTimestamp: string;
  tags: Record<string, unknown> | null;
}
