import {Container, Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildVcsInfo} from 'sentry/views/preprod/components/buildVcsInfo';
import {InstallDetailsContent} from 'sentry/views/preprod/components/installDetailsContent';
import {BuildInstallHeader} from 'sentry/views/preprod/install/buildInstallHeader';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export default function InstallPage() {
  const {artifactId} = useParams<{artifactId: string}>();
  const organization = useOrganization();

  const buildDetailsQuery = useApiQuery<BuildDetailsApiResponse>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/preprodartifacts/$headArtifactId/build-details/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            headArtifactId: artifactId,
          },
        }
      ),
    ],
    {
      staleTime: 0,
      enabled: !!artifactId,
    }
  );
  return (
    <SentryDocumentTitle title="Install">
      <Layout.Page>
        <Layout.Header>
          <BuildInstallHeader
            buildDetailsQuery={buildDetailsQuery}
            projectId={buildDetailsQuery.data?.project_slug}
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
                    <InstallDetailsContent artifactId={artifactId} size="lg" />
                  </Container>
                </Container>
                {buildDetailsQuery.data && (
                  <BuildVcsInfo buildDetailsData={buildDetailsQuery.data} />
                )}
              </Flex>
            </Layout.Main>
          </UrlParamBatchProvider>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
