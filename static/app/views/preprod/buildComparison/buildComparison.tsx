import {useTheme} from '@emotion/react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {BuildCompareHeaderContent} from 'sentry/views/preprod/buildComparison/header/buildCompareHeaderContent';
import {SizeCompareMainContent} from 'sentry/views/preprod/buildComparison/main/sizeCompareMainContent';
import {SizeCompareSelectionContent} from 'sentry/views/preprod/buildComparison/main/sizeCompareSelectionContent';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getCompareApiUrl} from 'sentry/views/preprod/utils/buildLinkUtils';
import {
  handleStaffPermissionError,
  type StaffErrorDetail,
} from 'sentry/views/preprod/utils/staffPermissionError';

export default function BuildComparison() {
  const organization = useOrganization();
  const theme = useTheme();
  const {headArtifactId, baseArtifactId} = useParams<{
    baseArtifactId?: string;
    headArtifactId?: string;
  }>();

  const headBuildDetailsQuery = useApiQuery<BuildDetailsApiResponse>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/preprodartifacts/$headArtifactId/build-details/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            headArtifactId: headArtifactId!,
          },
        }
      ),
    ],
    {
      staleTime: 0,
      enabled: !!headArtifactId,
    }
  );

  const compareUrl = getCompareApiUrl({
    organizationSlug: organization.slug,
    headArtifactId: headArtifactId!,
    baseArtifactId: baseArtifactId!,
  });

  const queryClient = useQueryClient();
  const {mutate: rerunComparison, isPending: isRerunning} = useMutation<
    {status: string},
    RequestError
  >({
    mutationFn: () => {
      return fetchMutation({url: `${compareUrl}?rerun=true`, method: 'POST'});
    },
    onSuccess: response => {
      if (response?.status === 'exists') {
        addErrorMessage(t('Comparison already exists'));
      } else {
        addSuccessMessage(t('Comparison rerun triggered'));
      }
      queryClient.invalidateQueries({queryKey: [compareUrl]});
    },
    onError: (error: RequestError) => {
      if (error.status === 403) {
        handleStaffPermissionError(error.responseJSON?.detail as StaffErrorDetail);
        return;
      }
      addErrorMessage(t('Failed to rerun comparison'));
    },
  });

  if (headBuildDetailsQuery.isLoading) {
    return (
      <SentryDocumentTitle title={t('Build comparison')}>
        <Stack flex={1}>
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
        <Layout.Header>
          <BuildCompareHeaderContent
            buildDetails={headBuildDetailsQuery.data}
            headArtifactId={headArtifactId}
            baseArtifactId={baseArtifactId}
            onRerunComparison={() => rerunComparison()}
            isRerunning={isRerunning}
          />
        </Layout.Header>

        <Layout.Body>
          <Layout.Main width="full">{mainContent}</Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
