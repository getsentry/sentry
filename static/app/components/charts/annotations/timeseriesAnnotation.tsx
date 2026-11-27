import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';

type TimeseriesAnnotationType =
  | 'inbound_filter_change'
  | 'infrastructure_change'
  | 'sdk_update'
  | 'sentry_outage'
  | 'custom'
  | 'feature_flag_change';

export const TIMESERIES_ANNOTATION_TYPE_LABELS: Record<TimeseriesAnnotationType, string> =
  {
    inbound_filter_change: t('Inbound filter change'),
    infrastructure_change: t('Infrastructure change'),
    sdk_update: t('SDK update'),
    sentry_outage: t('Sentry outage'),
    custom: t('Custom'),
    feature_flag_change: t('Feature flag change'),
  };

const TIMESERIES_ANNOTATION_TYPE_FEATURES: Partial<
  Record<TimeseriesAnnotationType, string>
> = {
  inbound_filter_change: 'timeseries-annotations-usecase-filter-change',
  feature_flag_change: 'timeseries-annotations-usecase-feature-flag-change',
};

/**
 * Annotation types are shown only once their feature flag is on, and types
 * without a flag are never shown.
 */
export function isTimeseriesAnnotationTypeEnabled(
  annotationType: TimeseriesAnnotationType,
  organization: Organization
): boolean {
  const feature = TIMESERIES_ANNOTATION_TYPE_FEATURES[annotationType];
  return defined(feature) && organization.features.includes(feature);
}

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
 * returned by `/organizations/{org}/timeseries-annotations/`.
 */
export interface TimeseriesAnnotation {
  annotationType: TimeseriesAnnotationType;
  createdBy: {id: string; type: 'user' | 'service_account'} | null;
  createdByLabel: string | null;
  dateAdded: string;
  dateUpdated: string;
  description: string;
  endTimestamp: string | null;
  environmentId: string | null;
  id: string;
  intervalType: 'point' | 'range';
  organizationId: string;
  pinned: boolean;
  projectId: string | null;
  scope: TimeseriesAnnotationScope;
  severity: TimeseriesAnnotationSeverity;
  startTimestamp: string;
  tags: Record<string, unknown> | null;
}

export function timeseriesAnnotationEnd({
  intervalType,
  endTimestamp,
}: TimeseriesAnnotation): number | 'ongoing' | undefined {
  if (endTimestamp) {
    return new Date(endTimestamp).getTime();
  }
  return intervalType === 'range' ? 'ongoing' : undefined;
}
