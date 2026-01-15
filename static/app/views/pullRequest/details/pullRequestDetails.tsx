import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {TabList} from 'sentry/components/core/tabs';
import {Heading, Text} from 'sentry/components/core/text';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {PullRequestDetailsHeaderContent} from 'sentry/views/pullRequest/details/header/pullRequestDetailsHeaderContent';
import {PullRequestDetailsMainContent} from 'sentry/views/pullRequest/details/main/pullRequestDetailsMainContent';
import {PullRequestDetailsSizeContent} from 'sentry/views/pullRequest/details/main/pullRequestDetailsSizeContent';
import type {
  PullRequestDetailsErrorResponse,
  PullRequestDetailsResponse,
  PullRequestDetailsSuccessResponse,
} from 'sentry/views/pullRequest/types/pullRequestDetailsTypes';

export default function PullRequestDetails() {
  const organization = useOrganization();
  const params = useParams() as {prId: string; repoName: string; repoOrg: string};
  const [selectedTab, setSelectedTab] = useQueryParamState<'files' | 'size_analysis'>({
    fieldName: 'tab',
  });

  const pullRequestQuery: UseApiQueryResult<PullRequestDetailsResponse, RequestError> =
    useApiQuery<PullRequestDetailsResponse>(
      [
        `/projects/${organization.slug}/pullrequest-details/${params.repoOrg}/${params.repoName}/${params.prId}/`,
      ],
      {
        staleTime: 0,
        enabled: !!params.repoName && !!params.prId,
      }
    );

  const {data, isLoading, error} = pullRequestQuery;

  if (isLoading) {
    return (
      <Layout.Page>
        <Layout.Header>
          <Layout.Title>Pull Request Details</Layout.Title>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main>
            <Flex justify="center" align="center" minHeight="200px">
              <LoadingIndicator />
            </Flex>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  const errorData = error?.responseJSON as PullRequestDetailsErrorResponse | undefined;
  if (error || !data) {
    return (
      <Layout.Page>
        <Layout.Header>
          <Layout.Title>Pull Request Details</Layout.Title>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main>
            <Container background="primary" radius="lg" padding="xl" border="primary">
              <Stack gap="md">
                <Heading as="h2">Error Loading Pull Request</Heading>
                <Text>
                  {errorData?.message ||
                    error?.message ||
                    'Failed to load pull request details'}
                </Text>
                {errorData?.details && (
                  <Text variant="muted" size="sm">
                    {errorData.details}
                  </Text>
                )}
              </Stack>
            </Container>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  const prSuccessData = data as PullRequestDetailsSuccessResponse;
  const hasSizeAnalysis = prSuccessData.build_details.length > 0;

  let mainContent = <PullRequestDetailsMainContent pullRequest={prSuccessData} />;
  if (selectedTab === 'size_analysis' && hasSizeAnalysis) {
    mainContent = (
      <PullRequestDetailsSizeContent buildDetails={prSuccessData.build_details} />
    );
  }

  return (
    <Layout.Page
      title={`#${prSuccessData.pull_request.number}: ${prSuccessData.pull_request.title}`}
    >
      <Layout.Header>
        <PullRequestDetailsHeaderContent pullRequest={prSuccessData} />
        <Layout.HeaderTabs value={selectedTab || 'files'} onChange={setSelectedTab}>
          <TabList>
            <TabList.Item key="files">{t('Files')}</TabList.Item>
            {hasSizeAnalysis ? (
              <TabList.Item key="size_analysis">{t('Size Analysis')}</TabList.Item>
            ) : null}
          </TabList>
        </Layout.HeaderTabs>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main width="full">{mainContent}</Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}
