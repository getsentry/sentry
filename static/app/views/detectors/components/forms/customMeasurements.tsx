import {useMemo} from 'react';
import type {Query} from 'history';

import {getFieldTypeFromUnit} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {useApiQuery} from 'sentry/utils/queryClient';

type MeasurementsMetaResponse = Record<string, {functions: string[]; unit: string}>;

export function useCustomMeasurements(
  organization: Organization,
  selection?: PageFilters
) {
  const query: Query = selection?.datetime
    ? {...normalizeDateTimeParams(selection.datetime)}
    : {};

  if (selection?.projects) {
    query.project = selection.projects.map(String);
  }

  const {data, isLoading, isError} = useApiQuery<MeasurementsMetaResponse>(
    [`/organizations/${organization.slug}/measurements-meta/`, {query}],
    {
      staleTime: Infinity,
    }
  );

  const customMeasurements = useMemo(() => {
    return data
      ? Object.keys(data).reduce<CustomMeasurementCollection>(
          (acc, customMeasurement) => {
            acc[customMeasurement] = {
              key: customMeasurement,
              name: customMeasurement,
              functions: data[customMeasurement]!.functions,
              unit: data[customMeasurement]!.unit,
              fieldType: getFieldTypeFromUnit(data[customMeasurement]!.unit),
            };
            return acc;
          },
          {}
        )
      : {};
  }, [data]);

  return {
    customMeasurements,
    isLoading,
    isError,
  };
}
