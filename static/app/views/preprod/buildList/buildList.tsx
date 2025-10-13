import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';

export default function BuildList() {
  const organization = useOrganization();
  const params = useParams<{projectSlug: string}>();
  const projectSlug = params.projectSlug;

  const {cursor} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
    },
  });

  const queryParams: Record<string, any> = {
    per_page: 25,
  };

  if (cursor) {
    queryParams.cursor = cursor;
  }

  const buildsQuery: UseApiQueryResult<ListBuildsApiResponse, RequestError> =
    useApiQuery<ListBuildsApiResponse>(
      [
        `/projects/${organization.slug}/${projectSlug}/preprodartifacts/list-builds/`,
        {query: queryParams},
      ],
      {
        staleTime: 0,
        enabled: !!projectSlug,
      }
    );

  const {data: buildsData, isLoading, error, getResponseHeader} = buildsQuery;

  const builds = buildsData?.builds || [];
  const pageLinks = getResponseHeader?.('Link') || null;

  return (
    <SentryDocumentTitle title="Build list">
      <Layout.Page>
        <Layout.Header>
          <Layout.Title>Builds</Layout.Title>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <Flex direction="column" gap="md">
              <PreprodBuildsTable
                builds={builds}
                isLoading={isLoading}
                error={!!error}
                pageLinks={pageLinks}
                organizationSlug={organization.slug}
                projectSlug={projectSlug}
              />
            </Flex>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
