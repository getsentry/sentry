import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import {useOrganization} from 'sentry/utils/useOrganization';
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
      <Stack flex={1}>
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
                    {buildDetailsQuery.isPending ? (
                      <Flex direction="column" align="center" gap="lg">
                        <LoadingIndicator />
                        <Text>{t('Loading build details...')}</Text>
                      </Flex>
                    ) : buildDetailsQuery.isError || !buildDetailsQuery.data ? (
                      <Flex direction="column" align="center" gap="lg">
                        <Text>
                          {t(
                            'Error: %s',
                            buildDetailsQuery.error?.message ||
                              'Failed to fetch build details'
                          )}
                        </Text>
                        <Button onClick={() => buildDetailsQuery.refetch()}>
                          {t('Retry')}
                        </Button>
                      </Flex>
                    ) : (
                      <InstallDetailsContent
                        artifactId={artifactId}
                        size="lg"
                        projectSlug={buildDetailsQuery.data.project_slug}
                        distributionErrorCode={
                          buildDetailsQuery.data.distribution_info?.error_code
                        }
                        distributionErrorMessage={
                          buildDetailsQuery.data.distribution_info?.error_message
                        }
                      />
                    )}
                  </Container>
                </Container>
                {buildDetailsQuery.data && (
                  <BuildVcsInfo buildDetailsData={buildDetailsQuery.data} />
                )}
              </Flex>
            </Layout.Main>
          </UrlParamBatchProvider>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
