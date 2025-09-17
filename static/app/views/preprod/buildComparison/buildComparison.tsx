import {useTheme} from '@emotion/react';

import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildCompareHeaderContent} from 'sentry/views/preprod/buildComparison/header/buildCompareHeaderContent';
import {SizeCompareMainContent} from 'sentry/views/preprod/buildComparison/main/sizeCompareMainContent';
import {SizeCompareSelectionContent} from 'sentry/views/preprod/buildComparison/main/sizeCompareSelectionContent';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export default function BuildComparison() {
  const organization = useOrganization();
  const theme = useTheme();
  const params = useParams<{
    headArtifactId: string;
    // eslint-disable-next-line typescript-sort-keys/interface
    baseArtifactId: string | undefined;
    projectId: string;
  }>();

  const headArtifactId = params.headArtifactId;
  const baseArtifactId = params.baseArtifactId;
  const projectId = params.projectId;

  const headBuildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError> =
    useApiQuery<BuildDetailsApiResponse>(
      [
        `/projects/${organization.slug}/${projectId}/preprodartifacts/${headArtifactId}/build-details/`,
      ],
      {
        staleTime: 0,
        enabled: !!projectId && !!headArtifactId,
      }
    );

  if (headBuildDetailsQuery.isLoading) {
    return (
      <SentryDocumentTitle title={t('Build comparison')}>
        <Layout.Page>
          <Layout.Header>
            <Placeholder
              height="20px"
              width="200px"
              style={{marginBottom: theme.space.md}}
            />
          </Layout.Header>

          <Layout.Body>
            <Layout.Main>
              <LoadingIndicator />
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  if (headBuildDetailsQuery.isError || !headBuildDetailsQuery.data) {
    return (
      <Alert type="error">
        {headBuildDetailsQuery.error?.message || t('Failed to load build details')}
      </Alert>
    );
  }

  let mainContent = null;
  if (baseArtifactId) {
    // Base artifact provided in URL, show comparison state
    mainContent = <SizeCompareMainContent />;
  } else {
    // No base artifact provided in URL, show selection state
    mainContent = (
      <SizeCompareSelectionContent headBuildDetails={headBuildDetailsQuery.data} />
    );
  }

  return (
    <SentryDocumentTitle title={t('Build comparison')}>
      <Layout.Page>
        <Layout.Header>
          <BuildCompareHeaderContent
            buildDetails={headBuildDetailsQuery.data}
            projectId={projectId}
          />
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>{mainContent}</Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
