import {Heading} from '@sentry/scraps/text';

import {Alert} from 'sentry/components/core/alert';
import {Container, Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildVcsInfo} from 'sentry/views/preprod/components/buildVcsInfo';
import {InstallDetailsContent} from 'sentry/views/preprod/components/installDetailsContent';
import {BuildInstallHeader} from 'sentry/views/preprod/install/buildInstallHeader';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export default function InstallPage() {
  const params = useParams<{artifactId: string}>();
  const artifactId = params.artifactId;
  const location = useLocation();
  const projectId = decodeScalar(location.query.project);
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

  if (!projectId) {
    return (
      <Layout.Page>
        <Alert type="error" showIcon>
          {t('Project parameter required')}
        </Alert>
      </Layout.Page>
    );
  }

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
            <Layout.Main width="full-constrained">
              <Flex direction="column" gap="xl">
                <Container border="primary" radius="lg" overflow="hidden">
                  <Container background="secondary" borderBottom="primary" padding="xl">
                    <Flex justify="center" align="center" width="100%">
                      <Heading as="h2">{t('Download Build')}</Heading>
                    </Flex>
                  </Container>
                  <Container padding="2xl">
                    <InstallDetailsContent
                      projectId={projectId}
                      artifactId={artifactId}
                      size="lg"
                    />
                  </Container>
                </Container>
                {buildDetailsQuery.data && (
                  <BuildVcsInfo
                    buildDetailsData={buildDetailsQuery.data}
                    projectId={projectId}
                  />
                )}
              </Flex>
            </Layout.Main>
          </UrlParamBatchProvider>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
