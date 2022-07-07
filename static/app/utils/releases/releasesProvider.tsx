import {createContext, useContext, useEffect, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, PageFilters, Release} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';

import useApi from '../useApi';

function fetchReleases(api: Client, orgSlug: string, selection: PageFilters) {
  const {environments, projects} = selection;

  return api.requestPromise(`/organizations/${orgSlug}/releases/`, {
    method: 'GET',
    data: {
      sort: 'date',
      project: projects,
      per_page: 50,
      environments,
    },
  });
}

type ReleasesProviderProps = {
  children: React.ReactNode;
  organization: Organization;
  selection: PageFilters;
  skipLoad?: boolean;
};

function ReleasesProvider({
  children,
  organization,
  selection,
  skipLoad = false,
}: ReleasesProviderProps) {
  const api = useApi();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (skipLoad) {
      setLoading(false);
      return undefined;
    }

    let shouldCancelRequest = false;
    fetchReleases(api, organization.slug, selection)
      .then(response => {
        if (shouldCancelRequest) {
          setLoading(false);
          return;
        }
        setLoading(false);
        setReleases(response);
      })
      .catch(e => {
        if (shouldCancelRequest) {
          setLoading(false);
          return;
        }

        const errorResponse = e?.responseJSON ?? t('Unable to fetch releases');
        addErrorMessage(errorResponse);
        setLoading(false);
        handleXhrErrorResponse(errorResponse)(e);
      });
    return () => {
      shouldCancelRequest = true;
    };
  }, [skipLoad, api, organization.slug, selection]);

  return (
    <ReleasesContext.Provider value={{releases, loading}}>
      {children}
    </ReleasesContext.Provider>
  );
}

interface ReleasesContextValue {
  loading: boolean;
  releases: Release[];
}

const ReleasesContext = createContext<ReleasesContextValue | undefined>(undefined);

function useReleases() {
  const releasesContext = useContext(ReleasesContext);

  if (!releasesContext) {
    throw new Error('releasesContext was called outside of ReleasesProvider');
  }

  return releasesContext;
}

const ReleasesConsumer = ReleasesContext.Consumer;

export {ReleasesContext, ReleasesConsumer, ReleasesProvider, useReleases};
