import {useMemo} from 'react';
import type {Query} from 'history';

import {getFieldTypeFromUnit} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type MeasurementsMetaResponse = Record<string, {functions: string[]; unit: string}>;

export function useCustomMeasurements(selection?: PageFilters) {
  const organization = useOrganization();
  const query: Query = selection?.datetime
    ? normalizeDateTimeParams(selection.datetime)
    : {};

  if (selection?.projects) {
    query.project = selection.projects.map(String);
  }

  const {data, isPending, isError} = useApiQuery<MeasurementsMetaResponse>(
    [`/organizations/${organization.slug}/measurements-meta/`, {query}],
    {
      staleTime: Infinity,
    }
  );

  const customMeasurements = useMemo(() => {
    if (!data) {
      return {};
    }

    return Object.entries(data).reduce<CustomMeasurementCollection>(
      (acc, [customMeasurement, measurementData]) => {
        acc[customMeasurement] = {
          key: customMeasurement,
          name: customMeasurement,
          functions: measurementData.functions,
          unit: measurementData.unit,
          fieldType: getFieldTypeFromUnit(measurementData.unit),
        };
        return acc;
      },
      {}
    );
  }, [data]);

  return {
    customMeasurements,
    isPending,
    isError,
  };
}
