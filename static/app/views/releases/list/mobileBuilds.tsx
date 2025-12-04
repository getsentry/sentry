import {useMemo} from 'react';
import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';

type Props = {
  organization: Organization;
  projectSlug: string | undefined;
};

export default function MobileBuilds({organization, projectSlug}: Props) {
  const {cursor} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
    },
  });

  const buildsQueryParams = useMemo(() => {
    const query: Record<string, any> = {per_page: 25};

    if (cursor) {
      query.cursor = cursor;
    }

    return query;
  }, [cursor]);

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
      {query: buildsQueryParams},
    ],
    {
      staleTime: 0,
      enabled: !!projectSlug,
    }
  );

  if (!projectSlug) {
    return <LoadingIndicator />;
  }

  const builds = buildsData?.builds ?? [];
  const pageLinks = getResponseHeader?.('Link') ?? null;

  return (
    <BuildsContent>
      {buildsError && <LoadingError onRetry={refetch} />}
      <PreprodBuildsTable
        builds={builds}
        isLoading={isLoadingBuilds}
        error={!!buildsError}
        pageLinks={pageLinks}
        organizationSlug={organization.slug}
        projectSlug={projectSlug}
      />
    </BuildsContent>
  );
}

const BuildsContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
