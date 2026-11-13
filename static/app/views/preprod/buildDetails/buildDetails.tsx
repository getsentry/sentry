import {useEffect, useRef} from 'react';
import {IconDownload} from '@sentry/icons/download';
import {IconRefresh} from '@sentry/icons/refresh';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildError} from 'sentry/views/preprod/components/buildError';
import {PreprodQuotaAlert} from 'sentry/views/preprod/components/preprodQuotaAlert';
import type {AppSizeApiResponse} from 'sentry/views/preprod/types/appSizeTypes';
import {
  getBuildNumber,
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
    refetchInterval: query => {
      const sizeInfo = query.state.data?.json?.size_info;
      return isSizeInfoPendingOrProcessing(sizeInfo) ? 10_000 : false;
    },
  });

  const sizeInfo = buildDetailsQuery.data?.size_info;
  const isPendingOrProcessing = isSizeInfoPendingOrProcessing(sizeInfo);

  const appSizeQuery = useQuery({
    ...apiOptions.as<AppSizeApiResponse>()(
      '/organizations/$organizationIdOrSlug/files/preprodartifacts/$headArtifactId/size-analysis/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          headArtifactId: artifactId,
        },
        staleTime: 0,
      }
    ),
    retry: (failureCount, apiError) => {
      // By default we retry 404s 3 times which causes
      // latency when loading the page if there is no size-analysis
      // (which is legitimate if size was not run on this artifact).
      // Instead don't retry 404s:
      if (apiError instanceof RequestError && apiError.status === 404) {
        return false;
      }
      // Keep default behaviour otherwise:
      return failureCount < 2;
    },
    enabled: !!artifactId,
  });

  const {refetch: refetchAppSize} = appSizeQuery;
  const wasPendingOrProcessingRef = useRef(isPendingOrProcessing);

  useEffect(() => {
    if (wasPendingOrProcessingRef.current && !isPendingOrProcessing) {
      refetchAppSize();
    }
    wasPendingOrProcessingRef.current = isPendingOrProcessing;
  }, [isPendingOrProcessing, refetchAppSize]);

  const {mutate: onRerunAnalysis, isPending: isRerunning} = useMutation<
    void,
    RequestError
  >({
    mutationFn: () => {
      return fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/preprod-artifact/rerun-analysis/$headArtifactId/',
          {path: {organizationIdOrSlug: organization.slug, headArtifactId: artifactId}}
        ),
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast.success(t('Analysis rerun started successfully!'));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: error => {
      toast.error(t('Error: %s', error.message));
    },
  });

  const buildDetails = buildDetailsQuery.data;
  const projectSlug = buildDetails?.project_slug;
  const version = buildDetails?.app_info?.version;
  const buildNumber = getBuildNumber(buildDetails?.app_info);
  const project = projectSlug ? ProjectsStore.getBySlug(projectSlug) : undefined;
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
        <Stack flex={1}>
          <BuildError
            title="Build details unavailable"
            message={
              buildDetailsQuery.error instanceof RequestError &&
              typeof buildDetailsQuery.error.responseJSON?.error === 'string'
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
        </Stack>
      </SentryDocumentTitle>
    );
  }

  return (
    <SentryDocumentTitle title={title}>
      <Stack flex={1}>
        <PreprodQuotaAlert system />
        <BuildDetailsHeaderContent
          buildDetailsQuery={buildDetailsQuery}
          projectSlug={projectSlug ?? ''}
          artifactId={artifactId}
          projectType={projectType}
        />

        <Layout.Body gap={{zero: '2xl', '4xl': '3xl'}}>
          <Layout.Side
            minWidth={{zero: 'auto', '4xl': '325px'}}
            maxWidth={{zero: 'none', '4xl': '325px'}}
            row={{zero: 'auto', '4xl': '1'}}
          >
            <BuildDetailsSidebarContent
              buildDetailsData={buildDetailsQuery.data}
              isBuildDetailsPending={buildDetailsQuery.isLoading}
            />
          </Layout.Side>
          <Layout.Main row={{zero: 'auto', '4xl': '1'}}>
            <BuildDetailsMainContent
              appSizeQuery={appSizeQuery}
              onRerunAnalysis={onRerunAnalysis}
              isRerunning={isRerunning}
              buildDetailsData={buildDetailsQuery.data}
              isBuildDetailsPending={buildDetailsQuery.isLoading}
              projectType={projectType}
              projectId={projectSlug}
            />
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
