import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildVcsInfo} from 'sentry/views/preprod/components/buildVcsInfo';
import {InstallDetailsContent} from 'sentry/views/preprod/components/installDetailsContent';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

import {BuildInstallHeader} from './buildInstallHeader';

export default function InstallPage() {
  const {artifactId} = useParams<{artifactId: string}>();
  const organization = useOrganization();

  const buildDetailsQuery = useQuery({
    ...apiOptions.as<BuildDetailsApiResponse>()(
      '/organizations/$organizationIdOrSlug/preprodartifacts/$headArtifactId/build-details/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          headArtifactId: artifactId,
        },
        staleTime: 0,
      }
    ),
    enabled: !!artifactId,
  });
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
          <Layout.Main width="full-constrained">
            <Stack gap="xl">
              <Container border="primary" radius="lg" overflow="hidden">
                <Container background="secondary" borderBottom="primary" padding="xl">
                  <Flex justify="center" align="center" width="100%">
                    <Heading as="h2">{t('Download Build')}</Heading>
                  </Flex>
                </Container>
                <Container padding="2xl">
                  {buildDetailsQuery.isPending ? (
                    <Stack align="center" gap="lg">
                      <LoadingIndicator />
                      <Text>{t('Loading build details...')}</Text>
                    </Stack>
                  ) : buildDetailsQuery.isError || !buildDetailsQuery.data ? (
                    <Stack align="center" gap="lg">
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
                    </Stack>
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
                      installGroups={
                        buildDetailsQuery.data.distribution_info?.install_groups
                      }
                    />
                  )}
                </Container>
              </Container>
              {buildDetailsQuery.data && (
                <BuildVcsInfo buildDetailsData={buildDetailsQuery.data} />
              )}
            </Stack>
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
