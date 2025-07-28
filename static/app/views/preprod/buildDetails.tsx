import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildDetailsHeaderContent} from 'sentry/views/preprod/header/buildDetailsHeaderContent';

import {BuildDetailsMainContent} from './main/buildDetailsMainContent';
import {BuildDetailsSidebarContent} from './sidebar/buildDetailsSidebarContent';
import type {AppSizeApiResponse} from './types/appSizeTypes';
import type {BuildDetailsApiResponse} from './types/buildDetailsTypes';

export default function BuildDetails() {
  const organization = useOrganization();
  const params = useParams<{artifactId: string; projectId: string}>();
  const artifactId = params.artifactId;
  const projectId = params.projectId;

  const buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError> =
    useApiQuery<BuildDetailsApiResponse>(
      [
        `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/build-details/`,
      ],
      {
        staleTime: 0,
        enabled: !!projectId && !!artifactId,
      }
    );

  const appSizeQuery: UseApiQueryResult<AppSizeApiResponse, RequestError> =
    useApiQuery<AppSizeApiResponse>(
      [
        `/projects/${organization.slug}/${projectId}/files/preprodartifacts/${artifactId}/size-analysis/`,
      ],
      {
        staleTime: 0,
        enabled: !!projectId && !!artifactId,
      }
    );

  return (
    <SentryDocumentTitle title="Build details">
      <Layout.Page>
        <Layout.Header>
          <BuildDetailsHeaderContent buildDetailsQuery={buildDetailsQuery} />
        </Layout.Header>

        <Layout.Body>
          <Layout.Main>
            <BuildDetailsMainContent appSizeQuery={appSizeQuery} />
          </Layout.Main>

          <Layout.Side>
            <BuildDetailsSidebarContent
              buildDetailsQuery={buildDetailsQuery}
              artifactId={artifactId}
              projectId={projectId}
            />
          </Layout.Side>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
