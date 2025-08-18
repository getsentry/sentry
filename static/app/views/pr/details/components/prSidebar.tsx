import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text/text';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TimeSince from 'sentry/components/timeSince';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';

import PRSeerAnalysis from './prSeerAnalysis';
import type {PRIssuesData} from './types';

interface PRSidebarProps {
  issuesData: PRIssuesData | null;
  issuesError: string | null;
  issuesLoading: boolean;
  prId: string;
  repoName: string;
  performanceData?: {
    files: string[];
    message: string;
  };
  releasesData?: {
    files: string[];
    message: string;
  };
}

interface IssueListItemProps {
  issue: Group;
}

function IssueListItem({issue}: IssueListItemProps) {
  const organization = useOrganization();

  const issueUrl = normalizeUrl(
    `/organizations/${organization.slug}/issues/${issue.id}/`
  );

  return (
    <IssueItemContainer>
      <IssueContent>
        <IssueTitleRow>
          <IssueTitle
            onClick={e => {
              e.stopPropagation();
              window.open(issueUrl, '_blank');
            }}
          >
            {issue.title}
          </IssueTitle>
          <ExternalLinkIcon size="xs" />
        </IssueTitleRow>

        <IssueMetadata>
          <Text size="xs" bold variant="muted">
            {issue.project?.slug || 'Unknown Project'}
          </Text>
          <Text size="xs" variant="muted">
            • {issue.lastSeen ? <TimeSince date={issue.lastSeen} /> : t('Unknown')}
          </Text>
          <IssueStatusText status={issue.status} size="xs" bold uppercase>
            {issue.status}
          </IssueStatusText>
        </IssueMetadata>
      </IssueContent>
    </IssueItemContainer>
  );
}

function PRSidebar({
  issuesData,
  issuesLoading,
  issuesError,
  repoName,
  prId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  performanceData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  releasesData,
}: PRSidebarProps) {
  return (
    <Flex direction="column" gap="md">
      <PRSeerAnalysis repoName={repoName} prId={prId} issues={issuesData?.issues || []} />

      <Panel>
        <PanelHeader>{t('RELATED ISSUES')}</PanelHeader>
        <PanelBody withPadding>
          {issuesLoading ? (
            <PlaceholderMessage variant="muted" italic>
              {t('Loading issues...')}
            </PlaceholderMessage>
          ) : issuesError ? (
            <PlaceholderMessage variant="muted" italic>
              {issuesError}
            </PlaceholderMessage>
          ) : issuesData?.issues && issuesData.issues.length > 0 ? (
            <IssuesListContainer direction="column" gap="md">
              {issuesData.issues.map(issue => (
                <IssueListItem key={issue.id} issue={issue} />
              ))}
            </IssuesListContainer>
          ) : (
            <PlaceholderMessage variant="muted" italic>
              {t('No issues found affecting these files')}
            </PlaceholderMessage>
          )}
        </PanelBody>
      </Panel>

      {/* {performanceData && (
        <PerformancePanel>
          <PanelHeader>{t('Performance Impact')}</PanelHeader>
          <PanelBody>
            <PlaceholderMessage variant="muted" italic>
              {performanceData.message}
            </PlaceholderMessage>
          </PanelBody>
        </PerformancePanel>
      )}

      {releasesData && (
        <ReleasesPanel>
          <PanelHeader>{t('Release Information')}</PanelHeader>
          <PanelBody>
            <PlaceholderMessage variant="muted" italic>
              {releasesData.message}
            </PlaceholderMessage>
          </PanelBody>
        </ReleasesPanel>
      )} */}
    </Flex>
  );
}

// const PerformancePanel = styled(Panel)`
//   margin-bottom: ${space(2)};
// `;

// const ReleasesPanel = styled(Panel)`
//   margin-bottom: ${space(2)};
// `;

const PlaceholderMessage = styled(Text)`
  padding: ${space(2)};
`;

const IssuesListContainer = styled(Flex)`
  padding: ${space(1)};
`;

const IssueItemContainer = styled('div')`
  padding: ${space(1)} ${space(1.5)};
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  background: ${p => p.theme.background};
  transition: background-color 0.1s;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const IssueContent = styled('div')`
  flex: 1;
  min-width: 0;
`;

const IssueTitleRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  margin-bottom: ${space(0.5)};
`;

const IssueTitle = styled('button')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  width: 100%;

  &:hover {
    color: ${p => p.theme.linkColor};
  }

  &:focus {
    outline: 2px solid ${p => p.theme.focus};
    outline-offset: 2px;
  }
`;

const ExternalLinkIcon = styled(IconOpen)`
  color: ${p => p.theme.gray300};
  flex-shrink: 0;
`;

const IssueMetadata = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.gray300};
`;

const IssueStatusText = styled(Text)<{status: string}>`
  color: ${p => {
    switch (p.status) {
      case 'resolved':
        return p.theme.green300;
      case 'ignored':
        return p.theme.gray400;
      default:
        return p.theme.red300;
    }
  }};

  &::before {
    content: '•';
    margin-right: ${space(0.5)};
    color: ${p => p.theme.gray300};
  }
`;

export default PRSidebar;
