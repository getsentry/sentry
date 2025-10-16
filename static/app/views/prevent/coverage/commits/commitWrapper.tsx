import {Outlet, useLocation, useParams} from 'react-router-dom';
import styled from '@emotion/styled';

import type {Crumb} from 'sentry/components/breadcrumbs';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconCheckmark, IconGithub} from 'sentry/icons';
import {IconBranch} from 'sentry/icons/iconBranch';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makePreventPathname} from 'sentry/views/prevent/pathnames';
import {PREVENT_BASE_URL} from 'sentry/views/prevent/settings';

// This is the page header for the commit detail page.
// Mock data - would come from props/API in real implementation
const mockCommitData = {
  title: 'This PR has been updated to add some tests (#123)',
  author: {
    id: '1',
    email: 'flamefire@example.com',
    name: 'Flamefire',
    username: 'flamefire',
    ip_address: '',
  },
  timestamp: '1 hour ago',
  ciStatus: 'passed',
  branchName: 'Branch-name',
  githubUrl: 'https://github.com/example-org/example-repo/pull/123',
};

export default function CommitDetailWrapper() {
  const organization = useOrganization();
  const params = useParams<{sha: string}>();
  const commitHash = params.sha || 'd677638';

  const crumbs: Crumb[] = [
    {
      label: 'Code Coverage',
      to: makePreventPathname({
        organization,
        path: `/${PREVENT_BASE_URL}/commits/`,
      }),
    },
    {
      label: 'Commits',
      to: makePreventPathname({
        organization,
        path: `/${PREVENT_BASE_URL}/commits/`,
      }),
    },
    {
      label: commitHash,
    },
  ];

  return (
    <SentryDocumentTitle title={`Commit ${commitHash}`} orgSlug={organization.slug}>
      <PageContainer>
        <StyledHeader>
          <Layout.HeaderContent>
            <HeaderTop>
              <Breadcrumbs crumbs={crumbs} />
            </HeaderTop>
            <HeaderMain>
              <CommitTitle>{mockCommitData.title}</CommitTitle>
            </HeaderMain>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <GitHubButtonContainer>
              <LinkButton
                href={mockCommitData.githubUrl}
                external
                size="sm"
                icon={<IconGithub />}
              >
                View GitHub Pull Request
              </LinkButton>
            </GitHubButtonContainer>
          </Layout.HeaderActions>
          <CommitMetadata>
            <MetadataLeft>
              <UserAvatar user={mockCommitData.author} size={20} />
              <MetadataInfo>
                <AuthorName>{mockCommitData.author.name}</AuthorName>
                <span>committed</span>
                <CommitHashLink
                  href={`https://github.com/example-org/example-repo/commit/${commitHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconGithub size="xs" />
                  {commitHash}
                </CommitHashLink>
                <span>•</span>
                <Tooltip title="Aug 8, 2025 11:22:15 PM UTC">
                  <TimestampLink>{mockCommitData.timestamp}</TimestampLink>
                </Tooltip>
                <Tooltip title="This CI status is based on all of your non-Code Coverage related checks">
                  <CIStatus>
                    <IconCheckmark size="xs" color="green300" />
                    <span>CI Passed</span>
                  </CIStatus>
                </Tooltip>
                <BranchInfo>
                  <IconBranch size="xs" />
                  <span>{mockCommitData.branchName}</span>
                </BranchInfo>
              </MetadataInfo>
            </MetadataLeft>
          </CommitMetadata>
        </StyledHeader>

        <Layout.Body>
          <Layout.Main fullWidth>
            <CommitTabNavigation commitHash={commitHash} />
            <Outlet />
          </Layout.Main>
        </Layout.Body>
      </PageContainer>
    </SentryDocumentTitle>
  );
}

interface CommitTabNavigationProps {
  commitHash: string;
}

function CommitTabNavigation({commitHash}: CommitTabNavigationProps) {
  const organization = useOrganization();
  const location = useLocation();

  const tabs = [
    {
      label: t('Coverage details'),
      path: makePreventPathname({
        organization,
        path: `/${PREVENT_BASE_URL}/commits/${commitHash}/`,
      }),
      isActive: location.pathname.endsWith(`/commits/${commitHash}/`),
    },
    {
      label: t('History'),
      path: makePreventPathname({
        organization,
        path: `/${PREVENT_BASE_URL}/commits/${commitHash}/history/`,
      }),
      isActive: location.pathname.includes('/history'),
    },
    {
      label: t('YAML'),
      path: makePreventPathname({
        organization,
        path: `/${PREVENT_BASE_URL}/commits/${commitHash}/yaml/`,
      }),
      isActive: location.pathname.includes('/yaml'),
    },
  ];

  return (
    <TabContainer>
      <TabList>
        {tabs.map(tab => (
          <TabItem key={tab.label} isActive={tab.isActive}>
            <TabLink to={tab.path}>
              <TabLabel isActive={tab.isActive}>{tab.label}</TabLabel>
              {tab.isActive && <ActiveIndicator />}
            </TabLink>
          </TabItem>
        ))}
      </TabList>
    </TabContainer>
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
  margin-top: -5px;
`;

const CommitTitle = styled('h1')`
  font-size: 18px;
  font-weight: 500;
  margin: 0;
  color: ${p => p.theme.headingColor};
  letter-spacing: -0.01em;
`;

const GitHubButtonContainer = styled('div')`
  margin-top: ${p => p.theme.space.xl};
`;

const CommitMetadata = styled('div')`
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

const CommitHashLink = styled('a')`
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

// Tab Navigation Styled Components
const TabContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  padding: 0 ${p => p.theme.space['3xl']} 0 ${p => p.theme.space['2xl']};
`;

const TabList = styled('div')`
  display: flex;
  flex-direction: row;
`;

const TabItem = styled('div')<{isActive: boolean}>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: 0 ${p => p.theme.space.md};
  position: relative;
`;

const TabLink = styled(Link)`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  position: relative;
  width: 100%;
`;

const TabLabel = styled('div')<{isActive?: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${p => p.theme.space.md} 0;
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.14;
  text-align: center;
  color: ${p => (p.isActive ? p.theme.purple400 : p.theme.subText)};
`;

const ActiveIndicator = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: ${p => p.theme.purple300};
  border-radius: 1.5px 1.5px 0 0;
`;
