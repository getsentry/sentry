import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {
  fetchMutation,
  useApiQuery,
  useMutation,
  type UseApiQueryResult,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildError} from 'sentry/views/preprod/components/buildError';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';
import {
  isSizeInfoProcessing,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';

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
        refetchInterval: query => {
          const data = query.state.data;
          const sizeInfo = data?.[0]?.size_info;
          return isSizeInfoProcessing(sizeInfo) ? 10_000 : false;
        },
      }
    );

  const sizeInfo = buildDetailsQuery.data?.size_info;
  const isProcessing = isSizeInfoProcessing(sizeInfo);

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

  const wasProcessingRef = useRef(isProcessing);

  useEffect(() => {
    if (wasProcessingRef.current && !isProcessing) {
      appSizeQuery.refetch();
    }
    wasProcessingRef.current = isProcessing;
  }, [isProcessing, appSizeQuery]);

  const {mutate: onRerunAnalysis, isPending: isRerunning} = useMutation<
    void,
    RequestError
  >({
    mutationFn: () => {
      return fetchMutation({
        url: `/projects/${organization.slug}/${projectId}/preprod-artifact/rerun-analysis/${artifactId}/`,
        method: 'POST',
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Analysis rerun started successfully!'));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: error => {
      addErrorMessage(t('Error: %s', error.message));
    },
  });

  const buildDetails = buildDetailsQuery.data;
  const version = buildDetails?.app_info?.version;
  const buildNumber = buildDetails?.app_info?.build_number;
  const project = ProjectsStore.getBySlug(projectId);
  const projectType = project?.platform ?? null;

  let title = t('Build details');
  if (
    version !== undefined &&
    version !== null &&
    version !== '' &&
    buildNumber !== undefined &&
    buildNumber !== null &&
    buildNumber !== ''
  ) {
    title = t('Build details v%s (%s)', version, buildNumber);
  }

  if (
    buildDetailsQuery.isError ||
    (!buildDetailsQuery.data && !buildDetailsQuery.isLoading)
  ) {
    return (
      <SentryDocumentTitle title={title}>
        <Layout.Page>
          <BuildError
            title="Build details unavailable"
            message={
              typeof buildDetailsQuery.error?.responseJSON?.error === 'string'
                ? buildDetailsQuery.error?.responseJSON.error
                : t('Unable to load build details for this artifact')
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
            artifactId={artifactId}
            projectType={projectType}
          />
        </Layout.Header>

        <BuildDetailsBody>
          <UrlParamBatchProvider>
            <BuildDetailsSide>
              <BuildDetailsSidebarContent
                buildDetailsData={buildDetailsQuery.data}
                isBuildDetailsPending={buildDetailsQuery.isLoading}
                artifactId={artifactId}
                projectId={projectId}
              />
            </BuildDetailsSide>
            <BuildDetailsMain>
              <BuildDetailsMainContent
                appSizeQuery={appSizeQuery}
                onRerunAnalysis={onRerunAnalysis}
                isRerunning={isRerunning}
                buildDetailsData={buildDetailsQuery.data}
                isBuildDetailsPending={buildDetailsQuery.isLoading}
                projectType={projectType}
                projectId={projectId}
              />
            </BuildDetailsMain>
          </UrlParamBatchProvider>
        </BuildDetailsBody>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const BuildDetailsBody = styled(Layout.Body)`
  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    display: flex;
    flex-direction: row-reverse;
    gap: ${p => p.theme.space['3xl']};
  }
`;

const BuildDetailsMain = styled(Layout.Main)`
  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    width: 100%;
  }
`;

const BuildDetailsSide = styled(Layout.Side)`
  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    min-width: 325px;
    max-width: 325px;
  }
`;
