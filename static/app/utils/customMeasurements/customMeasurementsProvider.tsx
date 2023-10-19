import {useEffect, useState} from 'react';
import {Query} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {getFieldTypeFromUnit} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {Organization, PageFilters} from 'sentry/types';
import {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

import {
  CustomMeasurementsContext,
  CustomMeasurementsContextValue,
} from './customMeasurementsContext';

type MeasurementsMetaResponse = {
  [x: string]: {functions: string[]; unit: string};
};

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

type CustomMeasurementsProviderProps = {
  children:
    | React.ReactNode
    | ((props: CustomMeasurementsContextValue) => React.ReactNode);
  organization: Organization;
  selection?: PageFilters;
};

export function CustomMeasurementsProvider({
  children,
  organization,
  selection,
}: CustomMeasurementsProviderProps) {
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
            functions: response[customMeasurement].functions,
            unit: response[customMeasurement].unit,
            fieldType: getFieldTypeFromUnit(response[customMeasurement].unit),
          };
          return acc;
        }, {});

        setState({customMeasurements: newCustomMeasurements});
      })
      .catch((e: RequestError) => {
        if (shouldCancelRequest) {
          return;
        }

        const errorResponse = t('Unable to fetch custom performance metrics');
        addErrorMessage(errorResponse);
        handleXhrErrorResponse(errorResponse, e);
      });

    return () => {
      shouldCancelRequest = true;
    };
  }, [selection, api, organization]);

  return (
    <CustomMeasurementsContext.Provider value={state}>
      {typeof children === 'function' ? children(state) : children}
    </CustomMeasurementsContext.Provider>
  );
}
