import {useState} from 'react';
import {Outlet, useParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import {Tooltip} from 'sentry/components/core/tooltip';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCheckmark, IconGithub} from 'sentry/icons';
import {IconBranch} from 'sentry/icons/iconBranch';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {CodeCoverageView} from 'sentry/views/explore/codeChanges/codeChangesDetailCodeCoverage';
import {FilesChangedView} from 'sentry/views/explore/codeChanges/codeChangesDetailFilesChanged';
import {SizeAnalysisView} from 'sentry/views/explore/codeChanges/codeChangesDetailSizeAnalysis';
import {SnapshotsView} from 'sentry/views/explore/codeChanges/codeChangesDetailSnapshots';
import {mockPullRequestDetail} from 'sentry/views/explore/codeChanges/codeChangesMockData';
import {makeCodeChangesPathname} from 'sentry/views/explore/codeChanges/pathnames';

// Helper component to create commit links with proper organization context
function CommitLink({
  commitSha,
  children,
}: {
  children: React.ReactNode;
  commitSha: string;
}) {
  const organization = useOrganization();
  const commitPath = makeCodeChangesPathname({
    organization,
    path: `/commits/${commitSha}/`,
  });

  return <Link to={commitPath}>{children}</Link>;
}

export default function PullDetailWrapper() {
  const organization = useOrganization();
  const params = useParams<{pullId: string}>();
  const pullId = params.pullId || '123';

  const location = useLocation();
  const navigate = useNavigate();

  // Track if code-coverage tab has been visited
  const [hasVisitedCodeCoverage, setHasVisitedCodeCoverage] = useState(false);

  // Get current tab from URL query parameter, default to 'files-changed'
  const currentTab = Array.isArray(location.query.tab)
    ? location.query.tab[0]
    : location.query.tab || 'files-changed';

  const handleTabChange = (newTab: string) => {
    // Mark code-coverage tab as visited when user clicks on it
    if (newTab === 'code-coverage') {
      setHasVisitedCodeCoverage(true);
    }

    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        tab: newTab,
      },
    });
  };

  const crumbs: Crumb[] = [
    {
      label: 'Pull Requests',
      to: makeCodeChangesPathname({
        organization,
        path: '/',
      }),
    },
    {
      label: `#${pullId}`,
    },
  ];

  return (
    <SentryDocumentTitle title={`Pull Request #${pullId}`} orgSlug={organization.slug}>
      <PageContainer>
        <StyledHeader>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />
            <HeaderMain>
              <PullTitle>{mockPullRequestDetail.title}</PullTitle>
            </HeaderMain>
            <PullMetadata>
              <MetadataLeft>
                <UserAvatar user={mockPullRequestDetail.author} size={20} />
                <MetadataInfo>
                  <Text as="span" size="sm">
                    {mockPullRequestDetail.author.name}
                  </Text>
                  <Text as="span" variant="muted" size="sm">
                    opened pull request
                  </Text>
                  <PullIdLink
                    href={mockPullRequestDetail.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IconGithub size="xs" />#{pullId}
                  </PullIdLink>
                  <Text as="span" variant="muted" size="sm">
                    •
                  </Text>
                  <Tooltip title="Aug 8, 2025 11:22:15 PM UTC">
                    <TimestampLink>
                      <Text as="span" variant="muted" size="sm">
                        {mockPullRequestDetail.timestamp}
                      </Text>
                    </TimestampLink>
                  </Tooltip>
                  <Tooltip title="This CI status is based on all of your non-Code Coverage related checks">
                    <CIStatus>
                      <IconCheckmark size="xs" color="green300" />
                      <Text as="span" variant="muted" size="sm">
                        CI Passed
                      </Text>
                    </CIStatus>
                  </Tooltip>
                  <BranchInfo>
                    <IconBranch size="xs" />
                    <Text as="span" variant="muted" size="sm">
                      {mockPullRequestDetail.branchName}
                    </Text>
                  </BranchInfo>
                </MetadataInfo>
              </MetadataLeft>
            </PullMetadata>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <LinkButton
              href={mockPullRequestDetail.githubUrl}
              external
              size="sm"
              icon={<IconGithub />}
            >
              View GitHub Pull Request
            </LinkButton>
          </Layout.HeaderActions>
        </StyledHeader>

        <Layout.Body>
          <Layout.Main width="full">
            <Tabs value={currentTab} onChange={handleTabChange}>
              <TabList>
                <TabList.Item key="files-changed">{t('Files Changed')}</TabList.Item>
                <TabList.Item key="size-analysis">{t('Size Analysis')}</TabList.Item>
                <TabList.Item key="snapshots">{t('Snapshots')}</TabList.Item>
                <TabList.Item key="code-coverage">
                  <TabLabelWithIndicator>
                    {t('Code Coverage')}
                    {!hasVisitedCodeCoverage && (
                      <TabUnreadIndicator>
                        <Tooltip title={t('Unread')} skipWrapper>
                          <UnreadIndicator />
                        </Tooltip>
                      </TabUnreadIndicator>
                    )}
                  </TabLabelWithIndicator>
                </TabList.Item>
              </TabList>
              <TabPanels>
                <TabPanels.Item key="files-changed">
                  <FilesChangedView />
                </TabPanels.Item>
                <TabPanels.Item key="size-analysis">
                  <SizeAnalysisView />
                </TabPanels.Item>
                <TabPanels.Item key="snapshots">
                  <SnapshotsView />
                </TabPanels.Item>
                <TabPanels.Item key="code-coverage">
                  <CodeCoverageView CommitLink={CommitLink} />
                </TabPanels.Item>
              </TabPanels>
            </Tabs>
            <Outlet />
          </Layout.Main>
        </Layout.Body>
      </PageContainer>
    </SentryDocumentTitle>
  );
}

const PageContainer = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const StyledHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  padding-bottom: ${p => p.theme.space.xl};
`;

const HeaderMain = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xl};
  margin-top: ${p => p.theme.space.sm};
  margin-bottom: ${p => p.theme.space.xs};
`;

const PullTitle = styled('h1')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
  color: ${p => p.theme.headingColor};
  line-height: ${p => p.theme.text.lineHeightHeading};
`;

const PullMetadata = styled('div')`
  display: flex;
  align-items: center;
  margin-top: ${p => p.theme.space.sm};
`;

const MetadataLeft = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;

const MetadataInfo = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

const PullIdLink = styled('a')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  text-decoration: none;

  &:hover {
    color: ${p => p.theme.linkHoverColor};
  }
`;

const TimestampLink = styled('span')`
  cursor: pointer;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const CIStatus = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const BranchInfo = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const TabLabelWithIndicator = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;

const TabUnreadIndicator = styled('div')`
  position: absolute;
  top: -4px;
  right: -8px;
`;

const UnreadIndicator = styled('div')`
  width: 6px;
  height: 6px;
  background-color: ${p => p.theme.purple400};
  border-radius: 50%;
`;
