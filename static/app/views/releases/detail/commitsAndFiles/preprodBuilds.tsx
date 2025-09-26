import {useContext, useEffect, useState} from 'react';

import {Container} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';
import {ReleaseContext} from 'sentry/views/releases/detail';

export default function PreprodBuilds() {
  const organization = useOrganization();
  const releaseContext = useContext(ReleaseContext);
  const projectSlug = releaseContext.project.slug;

  const params = useParams<{release: string}>();
  const location = useLocation();

  const {query: urlSearchQuery, cursor} = useLocationQuery({
    fields: {
      query: decodeScalar,
      cursor: decodeScalar,
    },
  });

  const [localSearchQuery, setLocalSearchQuery] = useState(urlSearchQuery || '');
  const debouncedLocalSearchQuery = useDebouncedValue(localSearchQuery);

  useEffect(() => {
    setLocalSearchQuery(urlSearchQuery || '');
  }, [urlSearchQuery]);

  useEffect(() => {
    if (debouncedLocalSearchQuery !== (urlSearchQuery || '')) {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          query: debouncedLocalSearchQuery.trim() || undefined,
          cursor: undefined, // Reset pagination when searching
        },
      });
    }
  }, [debouncedLocalSearchQuery, urlSearchQuery, location]);

  const queryParams: Record<string, any> = {
    per_page: 25,
    release_version: params.release,
  };

  if (cursor) {
    queryParams.cursor = cursor;
  }

  if (urlSearchQuery?.trim()) {
    queryParams.query = urlSearchQuery.trim();
  }

  const {
    data: buildsData,
    isPending: isLoadingBuilds,
    error: buildsError,
    refetch,
    getResponseHeader,
  }: UseApiQueryResult<
    ListBuildsApiResponse,
    RequestError
  > = useApiQuery<ListBuildsApiResponse>(
    [
      `/projects/${organization.slug}/${projectSlug}/preprodartifacts/list-builds/`,
      {query: queryParams},
    ],
    {
      staleTime: 0,
      enabled: !!projectSlug && !!params.release,
    }
  );

  const handleSearch = (query: string) => {
    setLocalSearchQuery(query);
  };

  const builds = buildsData?.builds || [];
  const pageLinks = getResponseHeader?.('Link') || null;

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <SentryDocumentTitle
          title={t('Preprod Builds - Release %s', formatVersion(params.release))}
          orgSlug={organization.slug}
          projectSlug={projectSlug}
        />
        {buildsError && <LoadingError onRetry={refetch} />}
        <Container paddingBottom="md">
          <SearchBar
            placeholder={t('Search by build, SHA, branch name, or pull request')}
            onChange={handleSearch}
            query={localSearchQuery}
          />
        </Container>
        <PreprodBuildsTable
          builds={builds}
          isLoading={isLoadingBuilds}
          error={!!buildsError}
          pageLinks={pageLinks}
          organizationSlug={organization.slug}
          projectSlug={projectSlug}
        />
      </Layout.Main>
    </Layout.Body>
  );
}
