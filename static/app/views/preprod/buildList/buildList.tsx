import {Flex} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import {usePreprodBuildsAnalytics} from 'sentry/views/preprod/hooks/usePreprodBuildsAnalytics';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';

export default function BuildList() {
  const organization = useOrganization();

  const {cursor, project: projectList} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      project: decodeList,
    },
  });
  const projects = Array.from(new Set(projectList.filter(Boolean)));
  const projectId = projects[0];

  const queryParams: Record<string, any> = {
    per_page: 25,
  };

  if (cursor) {
    queryParams.cursor = cursor;
  }

  if (projects.length > 0) {
    queryParams.project = projects.length === 1 ? projectId : projects;
  }

  const buildsQuery: UseApiQueryResult<ListBuildsApiResponse, RequestError> =
    useApiQuery<ListBuildsApiResponse>(
      [
        `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
        {query: queryParams},
      ],
      {
        staleTime: 0,
        enabled: projects.length > 0,
      }
    );

  const {data: buildsData, isLoading, error, getResponseHeader} = buildsQuery;

  const builds = buildsData?.builds || [];
  const pageLinks = getResponseHeader?.('Link') || null;

  usePreprodBuildsAnalytics({
    builds,
    cursor,
    display: PreprodBuildsDisplay.SIZE,
    enabled: projects.length > 0,
    error: !!error,
    isLoading,
    pageSource: 'preprod_builds_list',
    projectCount: projects.length,
  });

  return (
    <SentryDocumentTitle title="Build list">
      <Layout.Page>
        <Layout.Header>
          <Layout.Title>Builds</Layout.Title>
          <Layout.HeaderActions>
            {projects.length === 1 && (
              <Feature features="organizations:preprod-issues">
                <LinkButton
                  size="sm"
                  icon={<IconSettings />}
                  aria-label={t('Settings')}
                  to={`/settings/${organization.slug}/projects/${projectId}/preprod/`}
                />
              </Feature>
            )}
          </Layout.HeaderActions>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main width="full">
            <Flex direction="column" gap="md">
              <PreprodBuildsTable
                builds={builds}
                isLoading={isLoading}
                error={!!error}
                pageLinks={pageLinks}
                organizationSlug={organization.slug}
              />
            </Flex>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
