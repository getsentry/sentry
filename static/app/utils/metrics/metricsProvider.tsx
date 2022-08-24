import {useEffect, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {MetricsMetaCollection, MetricsTagCollection, Organization} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

import {MetricsContext, MetricsContextValue} from './metricsContext';

function fetchMetricMetas(
  api: Client,
  organization: Organization,
  projects?: number[]
): Promise<MetricsMetaCollection> {
  return api.requestPromise(`/organizations/${organization.slug}/metrics/meta/`, {
    query: {
      project: projects,
    },
  });
}

function fetchMetricTags(
  api: Client,
  organization: Organization,
  projects?: number[],
  fields?: string[]
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
  organization: Organization;
  fields?: string[];
  projects?: number[];
  skipLoad?: boolean;
};

export function MetricsProvider({
  children,
  fields,
  organization,
  projects,
  skipLoad = false,
}: MetricsProviderProps) {
  const api = useApi();
  const [state, setState] = useState({metas: {}, tags: {}});

  useEffect(() => {
    if (skipLoad) {
      return undefined;
    }

    let shouldCancelRequest = false;

    fetchMetricMetas(api, organization, projects)
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

        const errorResponse = e?.responseJSON ?? t('Unable to fetch metric metas');
        addErrorMessage(errorResponse);
        handleXhrErrorResponse(errorResponse)(e);
      });

    return () => {
      shouldCancelRequest = true;
    };
  }, [projects, organization.slug, api, skipLoad]);

  useEffect(() => {
    if (skipLoad) {
      return undefined;
    }

    let shouldCancelRequest = false;

    fetchMetricTags(api, organization, projects, fields)
      .then(response => {
        if (shouldCancelRequest) {
          return;
        }

        setState(oldState => ({...oldState, tags: response}));
      })
      .catch(e => {
        if (shouldCancelRequest) {
          return;
        }

        const errorResponse = e?.responseJSON ?? t('Unable to fetch metric tags');
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
