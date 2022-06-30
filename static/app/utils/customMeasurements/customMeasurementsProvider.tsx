import {useEffect, useState} from 'react';
import {Query} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {Organization, PageFilters} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import {MeasurementCollection} from 'sentry/utils/measurements/measurements';
import useApi from 'sentry/utils/useApi';

import {
  CustomMeasurementsContext,
  CustomMeasurementsContextValue,
} from './customMeasurementsContext';

function fetchCustomMeasurements(
  api: Client,
  organization: Organization,
  selection?: PageFilters
): Promise<MeasurementCollection> {
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

        const newCustomMeasurements = Object.keys(response).reduce<MeasurementCollection>(
          (acc, customMeasurement) => {
            acc[customMeasurement] = {
              key: customMeasurement,
              name: customMeasurement,
            };

            return acc;
          },
          {}
        );

        setState({customMeasurements: newCustomMeasurements});
      })
      .catch(e => {
        if (shouldCancelRequest) {
          return;
        }

        const errorResponse = e?.responseJSON ?? t('Unable to fetch custom measurements');
        addErrorMessage(errorResponse);
        handleXhrErrorResponse(errorResponse)(e);
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
