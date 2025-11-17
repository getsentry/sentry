import {useState} from 'react';
import {Outlet, useParams} from 'react-router-dom';
import styled from '@emotion/styled';

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
import {makeCodeChangesPathname} from 'sentry/views/explore/codeChanges/pathnames';

// Mock data - would come from props/API in real implementation
const mockPullData = {
  title: 'This PR has been updated to add some tests',
  author: {
    id: '1',
    email: 'flamefire@example.com',
    name: 'Flamefire',
    username: 'flamefire',
    ip_address: '',
  },
  timestamp: '1 hour ago',
  ciStatus: 'passed',
  branchName: 'at/add-tests',
  githubUrl: 'https://github.com/example-org/example-repo/pull/123',
};

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
    // {
    //   label: 'Code Changes',
    //   to: makeCodeChangesPathname({
    //     organization,
    //     path: '/',
    //   }),
    // },
    {
      label: 'Code Changes',
      to: {
        pathname: makeCodeChangesPathname({
          organization,
          path: '/',
        }),
        query: {tab: 'pulls'},
      },
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
            <HeaderTop>
              <Breadcrumbs crumbs={crumbs} />
            </HeaderTop>
            <HeaderMain>
              <PullTitle>{mockPullData.title}</PullTitle>
            </HeaderMain>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <GitHubButtonContainer>
              <LinkButton
                href={mockPullData.githubUrl}
                external
                size="sm"
                icon={<IconGithub />}
              >
                View GitHub Pull Request
              </LinkButton>
            </GitHubButtonContainer>
          </Layout.HeaderActions>
          <PullMetadata>
            <MetadataLeft>
              <UserAvatar user={mockPullData.author} size={20} />
              <MetadataInfo>
                <AuthorName>{mockPullData.author.name}</AuthorName>
                <span>opened pull request</span>
                <PullIdLink
                  href={mockPullData.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconGithub size="xs" />#{pullId}
                </PullIdLink>
                <span>•</span>
                <Tooltip title="Aug 8, 2025 11:22:15 PM UTC">
                  <TimestampLink>{mockPullData.timestamp}</TimestampLink>
                </Tooltip>
                <Tooltip title="This CI status is based on all of your non-Code Coverage related checks">
                  <CIStatus>
                    <IconCheckmark size="xs" color="green300" />
                    <span>CI Passed</span>
                  </CIStatus>
                </Tooltip>
                <BranchInfo>
                  <IconBranch size="xs" />
                  <span>{mockPullData.branchName}</span>
                </BranchInfo>
              </MetadataInfo>
            </MetadataLeft>
          </PullMetadata>
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
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']}
    ${p => p.theme.space['3xl']};
  position: relative;
  min-height: 109px;
`;

const HeaderTop = styled('div')``;

const HeaderMain = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xl};
  margin-top: 6px;
`;

const PullTitle = styled('h1')`
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: ${p => p.theme.headingColor};
  letter-spacing: -0.01em;
`;

const GitHubButtonContainer = styled('div')`
  margin-top: ${p => p.theme.space.xl};
`;

const PullMetadata = styled('div')`
  position: absolute;
  left: ${p => p.theme.space.xs};
  bottom: ${p => p.theme.space.xl};
  display: flex;
  align-items: center;
  grid-column: 1 / -1;
`;

const MetadataLeft = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.lg};
`;

const MetadataInfo = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  font-size: 12px;
  color: ${p => p.theme.subText};
`;

const AuthorName = styled('span')`
  font-weight: 500;
`;

const PullIdLink = styled('a')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.familyMono};

  &:hover {
    color: ${p => p.theme.linkHoverColor};
  }
`;

const TimestampLink = styled('span')`
  cursor: pointer;

  &:hover {
    color: ${p => p.theme.subText};
  }
`;

const CIStatus = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.subText};
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
