import {useCallback, useEffect, useState} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {BuildDetailsSidebarContent} from './sidebar/buildDetailsSidebarContent';
import type {BuildDetails} from './types';

export default function BuildDetails() {
  const api = useApi();
  const organization = useOrganization();
  const params = useParams<{artifactId: string; projectId: string}>();
  const artifactId = params.artifactId;
  const projectId = params.projectId;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildDetailsData, setBuildDetailsData] = useState<BuildDetails | null>(null);

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

  // TODO: Rich error state
  if (error) {
    return <div>{error}</div>;
  }

  // TODO: Rich loading state
  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <SentryDocumentTitle title="Build details">
      <Layout.Page>
        <Layout.Header>
          {/* TODO: Breadcrumbs once release connection is implemented */}
          {/* <Breadcrumbs crumbs={breadcrumbs} linkLastItem /> */}
          <Layout.Title title="Build Details" />
        </Layout.Header>

        <Layout.Body>
          <Layout.Main>
            <div>Main</div>
          </Layout.Main>

          <Layout.Side>
            <BuildDetailsSidebarContent
              buildDetails={buildDetailsData}
              isLoading={isLoading}
              error={error}
            />
          </Layout.Side>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
