import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  BuildDetailsHeaderContent,
  type BuildDetailsHeaderContentProps,
} from 'sentry/views/preprod/header/buildDetailsHeaderContent';

import {
  BuildDetailsSidebarContent,
  type BuildDetailsSidebarContentProps,
} from './sidebar/buildDetailsSidebarContent';
import type {BuildDetailsApiResponse} from './types';

export default function BuildDetails() {
  const organization = useOrganization();
  const params = useParams<{artifactId: string; projectId: string}>();
  const artifactId = params.artifactId;
  const projectId = params.projectId;

  const {
    data: buildDetailsData,
    isPending,
    isError,
    error,
  } = useApiQuery<BuildDetailsApiResponse>(
    [
      `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/build-details/`,
    ],
    {
      staleTime: 0,
      enabled: !!projectId && !!artifactId,
    }
  );

  let sidebarContentProps: BuildDetailsSidebarContentProps;
  let headerContentProps: BuildDetailsHeaderContentProps;
  if (isError) {
    sidebarContentProps = {
      status: 'error',
      error: error?.message || 'Failed to fetch build details data',
    };
    headerContentProps = {
      status: 'error',
      error: error?.message || 'Failed to fetch build details data',
    };
  } else if (isPending) {
    sidebarContentProps = {status: 'loading'};
    headerContentProps = {status: 'loading'};
  } else if (buildDetailsData) {
    sidebarContentProps = {
      status: 'success',
      buildDetails: buildDetailsData,
      projectId,
      artifactId,
    };
    headerContentProps = {status: 'success', buildDetails: buildDetailsData};
  } else {
    throw new Error('No build details data');
  }

  return (
    <SentryDocumentTitle title="Build details">
      <Layout.Page>
        <Layout.Header>
          <BuildDetailsHeaderContent {...headerContentProps} />
        </Layout.Header>

        <Layout.Body>
          <Layout.Main>
            {/* TODO: Main content */}
            <div>Main</div>
          </Layout.Main>

          <Layout.Side>
            <BuildDetailsSidebarContent {...sidebarContentProps} />
          </Layout.Side>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
