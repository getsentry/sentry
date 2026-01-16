import {Heading} from '@sentry/scraps/text';

import {Container, Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildVcsInfo} from 'sentry/views/preprod/components/buildVcsInfo';
import {InstallDetailsContent} from 'sentry/views/preprod/components/installDetailsContent';
import {BuildInstallHeader} from 'sentry/views/preprod/install/buildInstallHeader';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export default function InstallPage() {
  const {artifactId} = useParams<{artifactId: string}>();
  const {project: projectIds} = useLocationQuery({fields: {project: decodeList}});
  // TODO(EME-735): Remove this once refactoring is complete and we don't need to extract projects from the URL.
  if (projectIds.length !== 1) {
    throw new Error(
      `Expected exactly one project in query string but got ${projectIds.length}`
    );
  }
  const projectId = projectIds[0]!;
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
