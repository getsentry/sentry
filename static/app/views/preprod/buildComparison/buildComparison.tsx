import {useTheme} from '@emotion/react';

import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildComparisonHeaderContent} from 'sentry/views/preprod/buildComparison/header/buildComparisonHeaderContent';
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
      <Layout.Page title={t('Build comparison')}>
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
    );
  }

  if (headBuildDetailsQuery.isError || !headBuildDetailsQuery.data) {
    return <Alert type="error">{headBuildDetailsQuery.error?.message}</Alert>;
  }

  return (
    <Layout.Page title={t('Build comparison')}>
      <Layout.Header>
        <BuildComparisonHeaderContent
          buildDetails={headBuildDetailsQuery.data}
          projectId={projectId}
        />
      </Layout.Header>

      <Layout.Body>
        <Layout.Main>
          Build comparison main content head: {headArtifactId} base: {baseArtifactId}{' '}
          project: {projectId}
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}
