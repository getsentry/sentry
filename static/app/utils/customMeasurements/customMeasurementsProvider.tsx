import {useEffect, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
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
  projects?: number[]
): Promise<MeasurementCollection> {
  return api.requestPromise(`/organizations/${organization.slug}/measurements-meta/`, {
    query: {
      project: projects,
    },
  });
}

type CustomMeasurementsProviderProps = {
  children:
    | React.ReactNode
    | ((props: CustomMeasurementsContextValue) => React.ReactNode);
  organization: Organization;
  projects?: number[];
  skipLoad?: boolean;
};

export function CustomMeasurementsProvider({
  children,
  organization,
  projects,
  skipLoad = false,
}: CustomMeasurementsProviderProps) {
  const api = useApi();
  const [state, setState] = useState({customMeasurements: {}});

  useEffect(() => {
    if (skipLoad) {
      return undefined;
    }

    let shouldCancelRequest = false;

    fetchCustomMeasurements(api, organization, projects)
      .then(response => {
        if (shouldCancelRequest) {
          return;
        }

        setState(oldState => ({...oldState, metas: response}));
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
  }, [projects, api, skipLoad, organization]);

  return (
    <CustomMeasurementsContext.Provider value={state}>
      {typeof children === 'function' ? children(state) : children}
    </CustomMeasurementsContext.Provider>
  );
}
