import {useEffect, useReducer} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {MetricsMetaCollection, MetricsTagCollection, Organization} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

import {MetricsContext, MetricsContextValue} from './metricsContext';

async function fetchMetricMetas(
  api: Client,
  organization: Organization,
  projects: number[]
): Promise<MetricsMetaCollection> {
  return api.requestPromise(`/organizations/${organization.slug}/metrics/meta/`, {
    query: {
      project: projects,
    },
  });
}

async function fetchMetricTags(
  api: Client,
  organization: Organization,
  projects: number[],
  fields: string[]
): Promise<MetricsTagCollection> {
  return api.requestPromise(`/organizations/${organization.slug}/metrics/tags/`, {
    query: {
      project: projects,
      metrics: fields,
    },
  });
}

type MetricsProviderProps = {
  children: React.ReactNode | ((props: MetricsContextValue) => React.ReactNode);
  fields: string[];
  organization: Organization;
  projects: number[];
  skipLoad?: boolean;
};

type MetricsReducerAction =
  | {payload: MetricsContextValue['metas']; type: 'add metas'}
  | {payload: MetricsTagCollection; type: 'add tags'};

function MetricsReducer(
  state: MetricsContextValue,
  action: MetricsReducerAction
): MetricsContextValue {
  switch (action.type) {
    case 'add metas': {
      return {...state, metas: action.payload};
    }
    case 'add tags': {
      return {...state, tags: action.payload};
    }
    default: {
      return state;
    }
  }
}

export function MetricsProvider({
  children,
  projects,
  fields,
  organization,
  skipLoad = false,
}: MetricsProviderProps) {
  const api = useApi();
  const [state, dispatch] = useReducer(MetricsReducer, {metas: {}, tags: {}});

  useEffect(() => {
    if (!skipLoad) {
      return undefined;
    }

    let shouldCancelRequest = false;

    fetchMetricMetas(api, organization, projects ?? [])
      .then(response => {
        if (shouldCancelRequest) {
          return;
        }

        dispatch({type: 'add metas', payload: response});
      })
      .catch(e => {
        if (shouldCancelRequest) {
          return;
        }

        const errorResponse = e?.responseJSON ?? t('Unable to fetch metric fields');
        addErrorMessage(errorResponse);
        handleXhrErrorResponse(errorResponse)(e);
      });

    return () => {
      shouldCancelRequest = true;
    };
  }, [projects, organization.slug, api, skipLoad]);

  useEffect(() => {
    if (!skipLoad) {
      return undefined;
    }

    let shouldCancelRequest = false;

    fetchMetricTags(api, organization, projects ?? [], fields ?? [])
      .then(response => {
        if (shouldCancelRequest) {
          return;
        }

        dispatch({type: 'add tags', payload: response});
      })
      .catch(e => {
        if (shouldCancelRequest) {
          return;
        }

        const errorResponse = e?.responseJSON ?? t('Unable to fetch metric fields');
        addErrorMessage(errorResponse);
        handleXhrErrorResponse(errorResponse)(e);
      });

    return () => {
      shouldCancelRequest = true;
    };
  }, [projects, organization.slug, api, fields, skipLoad]);

  return (
    <MetricsContext.Provider value={state}>
      {typeof children === 'function' ? children(state) : children}
    </MetricsContext.Provider>
  );
}
