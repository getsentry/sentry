import {skipToken, useMutation, useQueryClient, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getCompareApiUrl,
  sizeComparisonApiOptions,
} from 'sentry/views/preprod/utils/buildLinkUtils';
import {handleStaffPermissionError} from 'sentry/views/preprod/utils/staffPermissionError';

import {BuildCompareHeaderContent} from './header/buildCompareHeaderContent';
import {SizeCompareMainContent} from './main/sizeCompareMainContent';
import {SizeCompareSelectionContent} from './main/sizeCompareSelectionContent';

export default function BuildComparison() {
  const organization = useOrganization();
  const {headArtifactId, baseArtifactId} = useParams<{
    baseArtifactId?: string;
    headArtifactId?: string;
  }>();

  const headBuildDetailsQuery = useQuery(
    apiOptions.as<BuildDetailsApiResponse>()(
      '/organizations/$organizationIdOrSlug/preprodartifacts/$headArtifactId/build-details/',
      {
        path: headArtifactId
          ? {
              organizationIdOrSlug: organization.slug,
              headArtifactId,
            }
          : skipToken,
        staleTime: 0,
      }
    )
  );

  const compareOptions = sizeComparisonApiOptions(
    headArtifactId && baseArtifactId
      ? {
          organizationSlug: organization.slug,
          headArtifactId,
          baseArtifactId,
        }
      : skipToken
  );

  const queryClient = useQueryClient();
  const {mutate: rerunComparison, isPending: isRerunning} = useMutation<
    {status: string},
    RequestError,
    {baseArtifactId: string; headArtifactId: string}
  >({
    mutationFn: artifacts => {
      return fetchMutation({
        url: getCompareApiUrl({
          organizationSlug: organization.slug,
          ...artifacts,
        }),
        method: 'POST',
        options: {query: {rerun: 'true'}},
      });
    },
    onSuccess: response => {
      if (response?.status === 'exists') {
        toast.error(t('Comparison already exists'));
      } else {
        toast.success(t('Comparison rerun triggered'));
      }
      queryClient.invalidateQueries({queryKey: compareOptions.queryKey});
    },
    onError: (error: RequestError) => {
      if (error.status === 403) {
        handleStaffPermissionError(error.responseJSON?.detail);
        return;
      }
      toast.error(t('Failed to rerun comparison'));
    },
  });

  if (headBuildDetailsQuery.isLoading) {
    return (
      <SentryDocumentTitle title={t('Build comparison')}>
        <Stack flex={1}>
          <BuildCompareHeaderContent
            headArtifactId={headArtifactId}
            baseArtifactId={baseArtifactId}
            isLoading
          />

          <Layout.Body>
            <Layout.Main>
              <LoadingIndicator />
            </Layout.Main>
          </Layout.Body>
        </Stack>
      </SentryDocumentTitle>
    );
  }

  if (headBuildDetailsQuery.isError || !headBuildDetailsQuery.data) {
    return (
      <Alert variant="danger">
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
      <Stack flex={1}>
        <BuildCompareHeaderContent
          buildDetails={headBuildDetailsQuery.data}
          headArtifactId={headArtifactId}
          baseArtifactId={baseArtifactId}
          onRerunComparison={
            headArtifactId && baseArtifactId
              ? () => rerunComparison({headArtifactId, baseArtifactId})
              : undefined
          }
          isRerunning={isRerunning}
        />

        <Layout.Body>
          <Layout.Main width="full">{mainContent}</Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
