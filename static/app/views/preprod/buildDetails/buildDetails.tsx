import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconDownload, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildError} from 'sentry/views/preprod/components/buildError';
import {PreprodQuotaAlert} from 'sentry/views/preprod/components/preprodQuotaAlert';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';
import {
  isSizeInfoPendingOrProcessing,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';

import {BuildDetailsHeaderContent} from './header/buildDetailsHeaderContent';
import {useBuildDetailsActions} from './header/useBuildDetailsActions';
import {BuildDetailsMainContent} from './main/buildDetailsMainContent';
import {BuildDetailsSidebarContent} from './sidebar/buildDetailsSidebarContent';

export default function BuildDetails() {
  const organization = useOrganization();
  const isSentryEmployee = useIsSentryEmployee();
  const {artifactId} = useParams<{artifactId: string}>();

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
      refetchInterval: query => {
        const data = query.state.data;
        const sizeInfo = data?.[0]?.size_info;
        return isSizeInfoPendingOrProcessing(sizeInfo) ? 10_000 : false;
      },
    }
  );

  const sizeInfo = buildDetailsQuery.data?.size_info;
  const isPendingOrProcessing = isSizeInfoPendingOrProcessing(sizeInfo);

  const appSizeQuery = useApiQuery<AppSizeApiResponse>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/files/preprodartifacts/$headArtifactId/size-analysis/',
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
      retry: (failureCount, apiError: RequestError) => {
        // By default we retry 404s 3 times which causes
        // latency when loading the page if there is no size-analysis
        // (which is legitimate if size was not run on this artifact).
        // Instead don't retry 404s:
        if (apiError?.status === 404) {
          return false;
        }
        // Keep default behaviour otherwise:
        return failureCount < 2;
      },
      enabled: !!artifactId,
    }
  );

  const wasPendingOrProcessingRef = useRef(isPendingOrProcessing);

  useEffect(() => {
    if (wasPendingOrProcessingRef.current && !isPendingOrProcessing) {
      appSizeQuery.refetch();
    }
    wasPendingOrProcessingRef.current = isPendingOrProcessing;
  }, [isPendingOrProcessing, appSizeQuery]);

  const {mutate: onRerunAnalysis, isPending: isRerunning} = useMutation<
    void,
    RequestError
  >({
    mutationFn: () => {
      return fetchMutation({
        url: `/organizations/${organization.slug}/preprod-artifact/rerun-analysis/${artifactId}/`,
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
  const projectSlug = buildDetails?.project_slug;
  const version = buildDetails?.app_info?.version;
  const buildNumber = buildDetails?.app_info?.build_number;
  const project = ProjectsStore.getBySlug(projectSlug);
  const projectType = project?.platform ?? null;

  const {handleDownloadAction, handleRerunAction} = useBuildDetailsActions({
    projectId: projectSlug ?? '',
    artifactId,
  });

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
          >
            {isSentryEmployee && (
              <Stack align="center" gap="lg">
                <Text variant="muted" size="sm">
                  {t('Sentry employees only')}
                </Text>
                <Flex gap="sm">
                  <Button icon={<IconRefresh />} onClick={handleRerunAction}>
                    {t('Rerun Analysis')}
                  </Button>
                  <Button icon={<IconDownload />} onClick={handleDownloadAction}>
                    {t('Download Build')}
                  </Button>
                </Flex>
              </Stack>
            )}
          </BuildError>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  return (
    <SentryDocumentTitle title={title}>
      <Layout.Page>
        <PreprodQuotaAlert system />
        <Layout.Header>
          <BuildDetailsHeaderContent
            buildDetailsQuery={buildDetailsQuery}
            projectSlug={projectSlug ?? ''}
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
                projectId={projectSlug ?? null}
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
                projectId={projectSlug}
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
