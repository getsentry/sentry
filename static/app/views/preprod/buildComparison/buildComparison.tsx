import {useTheme} from '@emotion/react';

import {Alert} from '@sentry/scraps/alert';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  useApiQuery,
  useMutation,
  useQueryClient,
  type UseApiQueryResult,
} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
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
  const {project: projectIds} = useLocationQuery({fields: {project: decodeList}});
  // TODO(EME-735): Remove this once refactoring is complete and we don't need to extract projects from the URL.
  if (projectIds.length !== 1) {
    throw new Error(
      `Expected exactly one project in query string but got ${projectIds.length}`
    );
  }
  const projectId = projectIds[0]!;

  const headBuildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError> =
    useApiQuery<BuildDetailsApiResponse>(
      [
        getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/preprodartifacts/$headArtifactId/build-details/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: projectId,
              headArtifactId: headArtifactId!,
            },
          }
        ),
      ],
      {
        staleTime: 0,
        enabled: !!projectId && !!headArtifactId,
      }
    );

  const compareUrl = getCompareApiUrl({
    organizationSlug: organization.slug,
    projectId,
    headArtifactId: headArtifactId!,
    baseArtifactId: baseArtifactId!,
  });

  const queryClient = useQueryClient();
  const {mutate: rerunComparison, isPending: isRerunning} = useMutation<
    {status: string},
    RequestError
  >({
    mutationFn: () => {
      return fetchMutation({url: compareUrl, method: 'POST'});
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
      <Layout.Page>
        <Layout.Header>
          <BuildCompareHeaderContent
            buildDetails={headBuildDetailsQuery.data}
            projectId={projectId}
            headArtifactId={headArtifactId}
            baseArtifactId={baseArtifactId}
            onRerunComparison={() => rerunComparison()}
            isRerunning={isRerunning}
          />
        </Layout.Header>

        <Layout.Body>
          <Layout.Main width="full">{mainContent}</Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
