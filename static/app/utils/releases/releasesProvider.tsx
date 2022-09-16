import {createContext, useContext, useEffect, useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {Organization, PageFilters, Release} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';

import useApi from '../useApi';

function fetchReleases(
  api: Client,
  orgSlug: string,
  selection: PageFilters,
  search: string
) {
  const {environments, projects, datetime} = selection;

  return api.requestPromise(`/organizations/${orgSlug}/releases/`, {
    method: 'GET',
    data: {
      sort: 'date',
      project: projects,
      per_page: 50,
      environment: environments,
      query: search,
      ...normalizeDateTimeParams(datetime),
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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(true);

  function handleSearch(search: string) {
    setSearchTerm(search);
  }

  useEffect(() => {
    if (skipLoad) {
      setLoading(false);
      return undefined;
    }

    let shouldCancelRequest = false;
    setLoading(true);
    fetchReleases(api, organization.slug, selection, searchTerm)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipLoad, api, organization.slug, JSON.stringify(selection), searchTerm]);

  return (
    <ReleasesContext.Provider value={{releases, loading, onSearch: handleSearch}}>
      {children}
    </ReleasesContext.Provider>
  );
}

interface ReleasesContextValue {
  loading: boolean;
  /**
   * This is an action provided to consumers for them to update the current
   * releases result set using a simple search query.
   *
   * Will always add new options into the store.
   */
  onSearch: (searchTerm: string) => void;
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
