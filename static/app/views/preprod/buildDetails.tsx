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
  BuildDetailsMainContent,
  type BuildDetailsMainContentProps,
} from './main/buildDetailsMainContent';
import {
  BuildDetailsSidebarContent,
  type BuildDetailsSidebarContentProps,
} from './sidebar/buildDetailsSidebarContent';
import type {AppSizeApiResponse} from './types/appSizeTypes';
import type {BuildDetailsApiResponse} from './types/buildDetailsTypes';

export default function BuildDetails() {
  const organization = useOrganization();
  const params = useParams<{artifactId: string; projectId: string}>();
  const artifactId = params.artifactId;
  const projectId = params.projectId;

  const {
    data: buildDetailsData,
    isPending: isBuildDetailsPending,
    isError: isBuildDetailsError,
    error: buildDetailsError,
  } = useApiQuery<BuildDetailsApiResponse>(
    [
      `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/build-details/`,
    ],
    {
      staleTime: 0,
      enabled: !!projectId && !!artifactId,
    }
  );

  const {
    data: appSizeData,
    isPending: isAppSizePending,
    isError: isAppSizeError,
    error: appSizeError,
  } = useApiQuery<AppSizeApiResponse>(
    [
      `/projects/${organization.slug}/${projectId}/files/preprodartifacts/${artifactId}/size-analysis/`,
    ],
    {
      staleTime: 0,
      enabled: !!projectId && !!artifactId,
    }
  );

  let sidebarContentProps: BuildDetailsSidebarContentProps;
  let headerContentProps: BuildDetailsHeaderContentProps;
  if (isBuildDetailsError) {
    sidebarContentProps = {
      status: 'error',
      error: buildDetailsError?.message || 'Failed to fetch build details data',
    };
    headerContentProps = {
      status: 'error',
      error: buildDetailsError?.message || 'Failed to fetch build details data',
    };
  } else if (isBuildDetailsPending) {
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

  let mainContentProps: BuildDetailsMainContentProps;
  if (isAppSizeError) {
    mainContentProps = {
      status: 'error',
      error: appSizeError?.message || 'Failed to fetch app size data',
    };
  } else if (isAppSizePending) {
    mainContentProps = {status: 'loading'};
  } else if (appSizeData) {
    mainContentProps = {status: 'success', appSizeData};
  } else {
    throw new Error('No app size data');
  }

  return (
    <SentryDocumentTitle title="Build details">
      <Layout.Page>
        <Layout.Header>
          <BuildDetailsHeaderContent {...headerContentProps} />
        </Layout.Header>

        <Layout.Body>
          <Layout.Main>
            <BuildDetailsMainContent {...mainContentProps} />
          </Layout.Main>

          <Layout.Side>
            <BuildDetailsSidebarContent {...sidebarContentProps} />
          </Layout.Side>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
