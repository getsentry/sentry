import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useApiQuery} from 'sentry/utils/queryClient';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {InstallDetailsContent} from 'sentry/views/preprod/components/installDetailsContent';
import {BuildInstallHeader} from 'sentry/views/preprod/install/buildInstallHeader';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export default function InstallPage() {
  const params = useParams<{artifactId: string; projectId: string}>();
  const artifactId = params.artifactId;
  const projectId = params.projectId;
  const organization = useOrganization();

  const buildDetailsQuery = useApiQuery<BuildDetailsApiResponse>(
    [
      `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/build-details/`,
    ],
    {
      staleTime: 0,
      enabled: !!projectId && !!artifactId,
    }
  );
  return (
    <SentryDocumentTitle title="Install">
      <Layout.Page>
        <Layout.Header>
          <BuildInstallHeader
            buildDetailsQuery={buildDetailsQuery}
            projectId={projectId}
          />
        </Layout.Header>

        <Layout.Body>
          <UrlParamBatchProvider>
            <Layout.Main>
              <InstallDetailsContent
                projectId={projectId}
                artifactId={artifactId}
                size="lg"
              />
            </Layout.Main>
          </UrlParamBatchProvider>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
