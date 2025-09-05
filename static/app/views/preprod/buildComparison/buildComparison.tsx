import {useTheme} from '@emotion/react';

import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildComparisonHeaderContent} from 'sentry/views/preprod/buildComparison/header/buildComparisonHeaderContent';
import {SizeComparisonView} from 'sentry/views/preprod/buildComparison/sizeComparisonView';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

interface SizeAnalysisComparison {
  comparison_id: number | null;
  error_code: string | null;
  error_message: string | null;
  identifier: string;
  metrics_artifact_type: string;
  state: 'SUCCESS' | 'FAILED' | 'PROCESSING' | 'PENDING';
}

interface SizeComparisonResponse {
  base_artifact_id: number;
  comparisons: SizeAnalysisComparison[];
  head_artifact_id: number;
}

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

  const sizeComparisonQuery: UseApiQueryResult<SizeComparisonResponse, RequestError> =
    useApiQuery<SizeComparisonResponse>(
      [
        `/projects/${organization.slug}/${projectId}/preprodartifacts/size-analysis/compare/${headArtifactId}/${baseArtifactId}/`,
      ],
      {
        staleTime: 0,
        enabled: !!projectId && !!headArtifactId && !!baseArtifactId,
      }
    );

  if (headBuildDetailsQuery.isLoading) {
    return (
      <SentryDocumentTitle title="Build comparison">
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
    return <Alert type="error">{headBuildDetailsQuery.error?.message}</Alert>;
  }

  return (
    <SentryDocumentTitle title="Build comparison">
      <Layout.Page>
        <Layout.Header>
          <BuildComparisonHeaderContent
            buildDetails={headBuildDetailsQuery.data}
            projectId={projectId}
          />
        </Layout.Header>

        <Layout.Body>
          <Layout.Main>
            {baseArtifactId ? (
              <SizeComparisonView
                sizeComparisonQuery={sizeComparisonQuery}
                headArtifactId={headArtifactId}
                baseArtifactId={baseArtifactId}
              />
            ) : (
              <div>
                Build comparison main content head: {headArtifactId} project: {projectId}
              </div>
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
