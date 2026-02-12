import {useEffect, useState} from 'react';
import type {Query} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {getFieldTypeFromUnit} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

import type {CustomMeasurementsContextValue} from './customMeasurementsContext';
import {CustomMeasurementsContext} from './customMeasurementsContext';

type MeasurementsMetaResponse = Record<string, {functions: string[]; unit: string}>;

function fetchCustomMeasurements(
  api: Client,
  organization: Organization,
  selection?: PageFilters
): Promise<MeasurementsMetaResponse> {
  const query: Query = selection?.datetime
    ? {...normalizeDateTimeParams(selection.datetime)}
    : {};

  if (selection?.projects) {
    query.project = selection.projects.map(String);
  }

  return api.requestPromise(`/organizations/${organization.slug}/measurements-meta/`, {
    method: 'GET',
    query,
  });
}

type CustomMeasurementsConfig = {
  organization: Organization;
  selection?: PageFilters;
};

type CustomMeasurementsProviderProps = {
  children:
    | React.ReactNode
    | ((props: CustomMeasurementsContextValue) => React.ReactNode);
} & CustomMeasurementsConfig;

export function CustomMeasurementsProvider({
  children,
  organization,
  selection,
}: CustomMeasurementsProviderProps) {
  const state = useCustomMeasurementsConfig({organization, selection});
  return (
    <CustomMeasurementsContext value={state}>
      {typeof children === 'function' ? children(state) : children}
    </CustomMeasurementsContext>
  );
}

export function useCustomMeasurementsConfig({
  organization,
  selection,
}: CustomMeasurementsConfig) {
  const api = useApi();
  const [state, setState] = useState({customMeasurements: {}});

  useEffect(() => {
    let shouldCancelRequest = false;
    fetchCustomMeasurements(api, organization, selection)
      .then(response => {
        if (shouldCancelRequest) {
          return;
        }

        const newCustomMeasurements = Object.keys(
          response
        ).reduce<CustomMeasurementCollection>((acc, customMeasurement) => {
          acc[customMeasurement] = {
            key: customMeasurement,
            name: customMeasurement,
            functions: response[customMeasurement]!.functions,
            unit: response[customMeasurement]!.unit,
            fieldType: getFieldTypeFromUnit(response[customMeasurement]!.unit),
          };
          return acc;
        }, {});

        setState({customMeasurements: newCustomMeasurements});
      })
      .catch((e: RequestError) => {
        if (shouldCancelRequest) {
          return;
        }

        const errorResponse = t('Unable to fetch custom performance measurements');
        addErrorMessage(errorResponse);
        handleXhrErrorResponse(errorResponse, e);
      });

    return () => {
      shouldCancelRequest = true;
    };
  }, [selection, api, organization]);

  return state;
}
