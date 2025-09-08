import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Client} from 'sentry/api';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

import {BuildDetailsHeaderContent} from './header/buildDetailsHeaderContent';
import {BuildDetailsMainContent} from './main/buildDetailsMainContent';
import {BuildDetailsSidebarContent} from './sidebar/buildDetailsSidebarContent';

export default function BuildDetails() {
  const organization = useOrganization();
  const params = useParams<{artifactId: string; projectId: string}>();
  const artifactId = params.artifactId;
  const projectId = params.projectId;

  // TODO: Remove artificial delays after testing loading states
  const buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError> =
    useApiQuery<BuildDetailsApiResponse>(
      [
        `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/build-details/`,
      ],
      {
        staleTime: 0,
        enabled: !!projectId && !!artifactId,
        // Artificial delay for testing sidebar loading state
        queryFn: async ({queryKey}) => {
          const api = new Client();
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          return api.requestPromise(queryKey[0]);
        },
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
        // Artificial delay for testing treemap loading state
        queryFn: async ({queryKey}) => {
          const api = new Client();
          await new Promise(resolve => setTimeout(resolve, 3500)); // 3.5 second delay (longer to see independent loading)
          return api.requestPromise(queryKey[0]);
        },
      }
    );

  const buildDetails = buildDetailsQuery.data;
  const version = buildDetails?.app_info?.version;
  const buildNumber = buildDetails?.app_info?.build_number;

  let title = t('Build details');
  if (
    version !== undefined &&
    version !== '' &&
    buildNumber !== undefined &&
    buildNumber !== ''
  ) {
    title = t('Build details v%s (%s)', version, buildNumber);
  }


  return (
    <SentryDocumentTitle title={title}>
      <Layout.Page>
        <Layout.Header>
          <BuildDetailsHeaderContent
            buildDetailsQuery={buildDetailsQuery}
            projectId={projectId}
          />
        </Layout.Header>

        <Layout.Body>
          <UrlParamBatchProvider>
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
          </UrlParamBatchProvider>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
