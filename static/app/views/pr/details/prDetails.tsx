import React, {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text/text';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import CommentsList from './components/commentsList';
import PRFilesList from './components/prFilesList';
import PRHeader from './components/prHeader';
import PRSidebar from './components/prSidebar';
import SnapshotTesting from './components/snapshots/snapshotTesting';
import type {PRCommentsData, PRData, PRIssuesData} from './components/types';

type TabType = 'files' | 'snapshots';

export default function PRDetails() {
  const params = useParams<{prId: string; repoName: string}>();
  const organization = useOrganization();
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're in the prevent context
  const isInPreventContext = window.location.pathname.includes('/prevent/pull-requests/');

  const [prData, setPrData] = useState<PRData | null>(null);
  const [issuesData, setIssuesData] = useState<PRIssuesData | null>(null);
  const [commentsData, setCommentsData] = useState<PRCommentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  // Initialize activeTab from URL query parameter, default to 'files'
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tabFromUrl = location.query.tab as TabType;
    return tabFromUrl === 'files' || tabFromUrl === 'snapshots' ? tabFromUrl : 'files';
  });

  // Fetch PR data (files, details, performance, etc.)
  useEffect(() => {
    const fetchPRData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use repo and PR parameters from URL to fetch real GitHub data
        const repoName = decodeURIComponent(params.repoName); // Decode URL-encoded repo name
        const prId = params.prId;

        // Fetch PR-related data (excluding issues) from our PR data endpoint
        const response = await api.requestPromise(
          `/organizations/${organization.slug}/pr-data/`,
          {
            method: 'GET',
            query: {
              repo: repoName,
              pr: prId,
              include: 'performance,releases', // No longer including issues
              statsPeriod: '14d',
            },
          }
        );

        setPrData(response);
      } catch (err) {
        setError(`Failed to load PR data: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPRData();
  }, [api, organization.slug, params.prId, params.repoName]);

  // Fetch issues data separately
  useEffect(() => {
    const fetchIssuesData = async () => {
      try {
        setIssuesLoading(true);
        setIssuesError(null);

        // Use repo and PR parameters from URL to fetch issues
        const repoName = decodeURIComponent(params.repoName);
        const prId = params.prId;

        // Fetch issues data from our dedicated issues endpoint
        const response = await api.requestPromise(
          `/organizations/${organization.slug}/pr-issues/`,
          {
            method: 'GET',
            query: {
              repo: repoName,
              pr: prId,
              statsPeriod: '14d',
              query: 'is:unresolved', // Only get unresolved issues
              limit: 25,
            },
          }
        );

        setIssuesData(response);
      } catch (err) {
        setIssuesError(`Failed to load issues data: ${err.message || err}`);
      } finally {
        setIssuesLoading(false);
      }
    };

    fetchIssuesData();
  }, [api, organization.slug, params.prId, params.repoName]);

  // Fetch comments data separately
  useEffect(() => {
    const fetchCommentsData = async () => {
      try {
        setCommentsLoading(true);
        setCommentsError(null);

        // Use repo and PR parameters from URL to fetch comments
        const repoName = decodeURIComponent(params.repoName);
        const prId = params.prId;

        // Fetch comments data from our dedicated comments endpoint
        const response = await api.requestPromise(
          `/organizations/${organization.slug}/pr-comments/`,
          {
            method: 'GET',
            query: {
              repo: repoName,
              pr: prId,
            },
          }
        );

        setCommentsData(response);
      } catch (err) {
        setCommentsError(`Failed to load comments data: ${err.message || err}`);
      } finally {
        setCommentsLoading(false);
      }
    };

    fetchCommentsData();
  }, [api, organization.slug, params.prId, params.repoName]);

  const performanceData = prData?.data?.performance;
  const releasesData = prData?.data?.releases;
  const prDetails = prData?.pr_details;

  // Breadcrumbs for prevent context navigation
  const breadcrumbItems = useMemo(() => {
    if (!isInPreventContext) return null;

    return [
      {
        label: 'Prevent',
        to: `/organizations/${organization.slug}/prevent/pull-requests/`,
      },
      {
        label: (
          <BreadcrumbWithIcon align="center" gap="sm">
            <IconGithub size="xs" />
            {t('Pull Requests')}
          </BreadcrumbWithIcon>
        ),
        to: `/organizations/${organization.slug}/prevent/pull-requests/`,
      },
      {
        label: decodeURIComponent(params.repoName),
        to: null,
      },
      {
        label: `PR #${params.prId}`,
        to: null,
      },
    ];
  }, [isInPreventContext, organization.slug, params.repoName, params.prId]);

  if (loading) {
    return (
      <SentryDocumentTitle title={`PR #${params.prId}`}>
        <Layout.Page>
          <Flex justify="center" align="center" style={{height: '400px'}}>
            <LoadingIndicator />
          </Flex>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  if (error) {
    return (
      <SentryDocumentTitle title={`PR #${params.prId}`}>
        <Layout.Page>
          <Flex justify="center" align="center" style={{height: '400px'}}>
            <ErrorMessage variant="danger">{error}</ErrorMessage>
          </Flex>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  const primaryContent = (
    <React.Fragment>
      <Main style={{display: activeTab === 'snapshots' ? 'none' : 'flex'}}>
        {/* Comments section above files */}
        {commentsData?.general_comments && commentsData.general_comments.length > 0 && (
          <CommentsList comments={commentsData.general_comments} title="Comments" />
        )}
        {commentsLoading && <div>Loading comments...</div>}
        {commentsError && (
          <div style={{color: 'red'}}>Error loading comments: {commentsError}</div>
        )}

        {prData?.pr_files && prData.pr_files.length > 0 && (
          <PRFilesList files={prData.pr_files} commentsData={commentsData} />
        )}
      </Main>

      {activeTab === 'snapshots' && (
        <SnapshotsMain>
          <SnapshotTesting />
        </SnapshotsMain>
      )}

      <Side style={{display: activeTab === 'snapshots' ? 'none' : 'grid'}}>
        <PRSidebar
          issuesData={issuesData}
          issuesLoading={issuesLoading}
          issuesError={issuesError}
          repoName={params.repoName}
          prId={params.prId}
          performanceData={performanceData}
          releasesData={releasesData}
        />
      </Side>
    </React.Fragment>
  );

  return (
    <SentryDocumentTitle title={`PR #${params.prId}`}>
      <Layout.Page>
        <Layout.Header>
          <PRHeader
            activeTab={activeTab}
            breadcrumbItems={breadcrumbItems}
            isInPreventContext={isInPreventContext}
            onTabChange={tab => {
              setActiveTab(tab);
              // Update URL with new tab
              const newQuery = new URLSearchParams(location.search);
              newQuery.set('tab', tab);
              navigate(`${location.pathname}?${newQuery.toString()}`);
            }}
            prData={prData}
            prDetails={prDetails}
            prId={params.prId}
            repoName={params.repoName}
          />
        </Layout.Header>

        <Body noRowGap>{primaryContent}</Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

// 65%/35% grid for main/side
const Body = styled(Layout.Body)`
  background: ${p => p.theme.backgroundSecondary};
  padding: 0px !important;

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    display: grid;
    grid-template-columns: 65% 35%;
    align-content: start;
    gap: 0px;
  }
`;

const Main = styled(Layout.Main)`
  padding: ${p => `${p.theme.space.xl} ${p.theme.space['3xl']}`};
  grid-column: 1/2;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
`;

const Side = styled(Layout.Side)`
  background: ${p => p.theme.background};
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']} ${p => p.theme.space.xl}
    ${p => p.theme.space.xl};
  border-left: 1px solid ${p => p.theme.border};
  grid-column: 2/3;
`;

const SnapshotsMain = styled(Layout.Main)`
  padding: ${p => `${p.theme.space.xl} ${p.theme.space['3xl']}`};
  grid-column: 1/3; /* Take up both columns when sidebar is hidden */
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
`;

const ErrorMessage = styled(Text)`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.red200};
  border-radius: 6px;
  background: ${p => p.theme.red100};
`;

const BreadcrumbWithIcon = styled(Flex)`
  align-items: center;
`;
