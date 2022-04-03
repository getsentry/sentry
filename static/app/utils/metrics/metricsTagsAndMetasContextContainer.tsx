import {createContext, useEffect, useMemo, useState} from 'react';

import {fetchMetricsFields, fetchMetricsTags} from 'sentry/actionCreators/metrics';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {MetricsMetaCollection, MetricsTagCollection} from 'sentry/types';
import {} from 'sentry/types/debugFiles';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export interface MetricsTagsAndMetasContextProps {
  metricsMetas: MetricsMetaCollection;
  metricsTags: MetricsTagCollection;
}

const MetricsTagsAndMetasContext = createContext<MetricsTagsAndMetasContextProps>({
  metricsTags: {},
  metricsMetas: {},
});

type ProviderProps = {
  children: React.ReactNode;
};

const MetricsTagsAndMetasContextContainer = ({children}: ProviderProps) => {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = useLegacyStore(PageFiltersStore);

  useEffect(() => {
    let unmounted = false;

    if (!unmounted) {
      fetchMetricsTags(api, organization.slug, selection.projects);
      fetchMetricsFields(api, organization.slug, selection.projects);
    }

    return () => {
      unmounted = true;
    };
  }, [organization.slug, selection.projects]);

  return (
    <MetricsTagsAndMetasContext.Provider value={(metricsMetas = {})}>
      {children}
    </MetricsTagsAndMetasContext.Provider>
  );
};

export {MetricsTagsAndMetasContextContainer, MetricsTagsAndMetasContext};
