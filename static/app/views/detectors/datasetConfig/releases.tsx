import type {SelectValue} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import {SessionField} from 'sentry/types/sessions';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import {ReleaseSearchBar} from 'sentry/views/detectors/datasetConfig/components/releaseSearchBar';
import {
  getReleasesSeriesQueryOptions,
  transformMetricsResponseToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/releasesSeries';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import type {DetectorDatasetConfig} from './base';

type ReleasesSeriesResponse = SessionApiResponse;

const AGGREGATE_OPTIONS: Readonly<Record<string, SelectValue<FieldValue>>> = {
  'function:crash_free_rate': {
    label: 'crash_free_rate',
    value: {
      kind: FieldValueKind.FUNCTION,
      meta: {
        name: 'crash_free_rate',
        parameters: [
          {
            kind: 'column',
            columnTypes: ['integer', 'string'],
            defaultValue: SessionField.SESSION,
            required: true,
          },
        ],
      },
    },
  },
  'field:session': {
    label: 'session',
    value: {
      kind: FieldValueKind.METRICS,
      meta: {
        name: SessionField.SESSION,
        dataType: 'integer',
      },
    },
  },
  'field:user': {
    label: 'user',
    value: {
      kind: FieldValueKind.METRICS,
      meta: {
        name: SessionField.USER,
        dataType: 'string',
      },
    },
  },
};

// For crash_free_rate, the aggregate we store in the backend is not user friendly so
// we use this mapping to display a more user friendly title.
const AGGREGATE_FUNCTION_MAP: Record<string, string> = {
  'crash_free_rate(session)':
    'percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate',
  'crash_free_rate(user)':
    'percentage(users_crashed, users) AS _crash_rate_alert_aggregate',
};

const fromApiAggregate = (aggregate: string) => {
  return (
    Object.keys(AGGREGATE_FUNCTION_MAP).find(
      key => AGGREGATE_FUNCTION_MAP[key] === aggregate
    ) ?? aggregate
  );
};

const toApiAggregate = (aggregate: string) => {
  return AGGREGATE_FUNCTION_MAP[aggregate] ?? aggregate;
};

export const DetectorReleasesConfig: DetectorDatasetConfig<ReleasesSeriesResponse> = {
  defaultField: ReleasesConfig.defaultField,
  getAggregateOptions: () => AGGREGATE_OPTIONS,
  SearchBar: ReleaseSearchBar,
  getSeriesQueryOptions: getReleasesSeriesQueryOptions,
  toApiAggregate,
  fromApiAggregate,
  transformSeriesQueryData: (data, aggregate) => {
    return [transformMetricsResponseToSeries(data, aggregate)];
  },
  transformComparisonSeriesData: () => {
    // Releases cannot have a comparison series currently
    return [];
  },
};
