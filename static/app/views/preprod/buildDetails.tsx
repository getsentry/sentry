import {useCallback, useEffect, useState} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useApi from 'sentry/utils/useApi';
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
  const api = useApi();
  const organization = useOrganization();
  const params = useParams<{artifactId: string; projectId: string}>();
  const artifactId = params.artifactId;
  const projectId = params.projectId;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buildDetailsData, setBuildDetailsData] =
    useState<BuildDetailsApiResponse | null>(null);

  const fetchBuildDetailsData = useCallback(async () => {
    if (!projectId || !artifactId) {
      setError('All fields are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setBuildDetailsData(null);
    try {
      const response = await api.requestPromise(
        `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/build-details/`,
        {
          method: 'GET',
        }
      );
      setBuildDetailsData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch build details data');
    } finally {
      setIsLoading(false);
    }
  }, [api, organization.slug, projectId, artifactId]);

  useEffect(() => {
    fetchBuildDetailsData();
  }, [fetchBuildDetailsData]);

  let sidebarContentProps: BuildDetailsSidebarContentProps;
  let headerContentProps: BuildDetailsHeaderContentProps;
  if (error) {
    sidebarContentProps = {status: 'error', error};
    headerContentProps = {status: 'error', error};
  } else if (isLoading) {
    sidebarContentProps = {status: 'loading'};
    headerContentProps = {status: 'loading'};
  } else if (buildDetailsData) {
    sidebarContentProps = {status: 'success', buildDetails: buildDetailsData};
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
