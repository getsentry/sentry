import {useTheme} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
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

  // If the main data fetch fails, show a single error state instead of per component
  if (
    buildDetailsQuery.isError ||
    (!buildDetailsQuery.data && !buildDetailsQuery.isPending)
  ) {
    return (
      <SentryDocumentTitle title={title}>
        <Layout.Page>
          <BuildError
            title="Build details unavailable"
            message={
              buildDetailsQuery.error?.message ||
              'Unable to load build details for this artifact' // TODO(preprod): translate once we have a final design
            }
          />
        </Layout.Page>
      </SentryDocumentTitle>
    );
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
              <BuildDetailsMainContent
                appSizeQuery={appSizeQuery}
                buildDetailsQuery={buildDetailsQuery}
              />
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

function BuildError({title, message}: {message: string; title: string}) {
  const theme = useTheme();
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      style={{minHeight: '60vh', padding: theme.space.md}}
    >
      <Flex
        direction="column"
        align="center"
        gap="lg"
        style={{maxWidth: '500px', textAlign: 'center'}}
      >
        <div style={{fontSize: '64px'}}>⚠️</div>
        <Heading as="h2">{title}</Heading>
        <Text color="subdued">{message}</Text>
      </Flex>
    </Flex>
  );
}
