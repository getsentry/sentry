import {createContext, useEffect, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {MetricsMetaCollection, MetricsTagCollection, Organization} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

interface ChildProps {
  metas: MetricsMetaCollection;
  tags: MetricsTagCollection;
}

export type MetricsContextProps = ChildProps | undefined;

const MetricsContext = createContext<MetricsContextProps>(undefined);

type ProviderProps = {
  children: React.ReactNode | ((props: ChildProps) => React.ReactNode);
  organization: Organization;
  fields?: string[];
  projects?: number[];
  skipLoad?: boolean;
};

function MetricsProvider({
  children,
  projects,
  fields,
  organization,
  skipLoad = false,
}: ProviderProps) {
  const api = useApi();
  const [metas, setMetas] = useState<MetricsMetaCollection>({});
  const [tags, setTags] = useState<MetricsTagCollection>({});

  useEffect(() => {
    let unmounted = false;

    if (!unmounted && !skipLoad) {
      fetchMetricMetas();
    }

    return () => {
      unmounted = true;
    };
  }, [projects, organization.slug, api, skipLoad]);

  useEffect(() => {
    let unmounted = false;

    if (!unmounted && !skipLoad) {
      fetchMetricTags();
    }

    return () => {
      unmounted = true;
    };
  }, [projects, organization.slug, api, fields, skipLoad]);

  async function fetchMetricMetas() {
    try {
      const response: MetricsMetaCollection = await api.requestPromise(
        `/organizations/${organization.slug}/metrics/meta/`,
        {
          query: {
            project: projects,
          },
        }
      );
      setMetas(response);
    } catch (error) {
      const errorResponse = error?.responseJSON ?? t('Unable to fetch metric fields');
      addErrorMessage(errorResponse);
      handleXhrErrorResponse(errorResponse)(error);
    }
  }

  async function fetchMetricTags() {
    try {
      const response: MetricsTagCollection = await api.requestPromise(
        `/organizations/${organization.slug}/metrics/tags/`,
        {
          query: {
            project: projects,
            metrics: fields,
          },
        }
      );
      setTags(response);
    } catch (error) {
      const errorResponse = error?.responseJSON ?? t('Unable to fetch metric tags');
      addErrorMessage(errorResponse);
      handleXhrErrorResponse(errorResponse)(error);
    }
  }

  return (
    <MetricsContext.Provider value={{metas, tags}}>
      {typeof children === 'function' ? children({metas, tags}) : children}
    </MetricsContext.Provider>
  );
}

export {MetricsProvider, MetricsContext};
