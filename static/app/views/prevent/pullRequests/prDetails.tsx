import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconChevron, IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

interface PRFileData {
  additions: number;
  changes: number;
  deletions: number;
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  // The diff content
  blob_url?: string;
  patch?: string;
  raw_url?: string;
}

interface PRDetails {
  body: string;
  created_at: string;
  html_url: string;
  merged_at: string | null;
  state: 'open' | 'closed';
  title: string;
  updated_at: string;
  user: {
    avatar_url: string;
    html_url: string;
    login: string;
  };
}

interface PRData {
  data: {
    performance?: {
      files: string[];
      message: string;
    };
    releases?: {
      files: string[];
      message: string;
    };
  };
  files: string[];
  statsPeriod: string;
  pr_details?: PRDetails;
  pr_files?: PRFileData[];
  pr_number?: string;
  repo?: string;
}

interface PRIssuesData {
  issues: Group[];
  meta: {
    query: string;
    has_more?: boolean;
    searches_performed?: number;
    total_count?: number;
  };
  pagination: {
    next?: string;
    prev?: string;
  };
}

export default function PRDetails() {
  const params = useParams<{prId: string; repoName: string}>();
  const organization = useOrganization();
  const api = useApi();

  const [prData, setPrData] = useState<PRData | null>(null);
  const [issuesData, setIssuesData] = useState<PRIssuesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Record<number, boolean>>({});
  const [expandedDescription, setExpandedDescription] = useState(false);

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

  // Initialize all files as expanded when data loads
  useEffect(() => {
    if (prData?.pr_files) {
      const initialExpanded: Record<number, boolean> = {};
      prData.pr_files.forEach((_, index) => {
        initialExpanded[index] = true;
      });
      setExpandedFiles(initialExpanded);
    }
  }, [prData?.pr_files]);

  // Memoized toggle function to prevent unnecessary re-renders
  const toggleFileExpanded = useCallback((index: number) => {
    setExpandedFiles(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  const performanceData = prData?.data?.performance;
  const releasesData = prData?.data?.releases;
  const prDetails = prData?.pr_details;

  // Breadcrumbs for navigation
  const breadcrumbItems = useMemo(
    () => [
      {
        label: 'Prevent',
        to: `/organizations/${organization.slug}/prevent/pull-requests/`,
      },
      {
        label: (
          <BreadcrumbWithIcon>
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
    ],
    [organization.slug, params.repoName, params.prId]
  );

  // Memoize the PR header section to prevent re-renders when file expansion state changes
  const headerSection = useMemo(
    () => (
      <Header>
        <BreadcrumbContainer>
          <Breadcrumbs crumbs={breadcrumbItems} />
        </BreadcrumbContainer>
        {prDetails ? (
          <PRTitleSection>
            <TitleRow>
              <PRTitle>{prDetails.title}</PRTitle>
              <ViewOnGitHubLink
                href={prDetails.html_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('View on GitHub')}
              </ViewOnGitHubLink>
            </TitleRow>
            <Metadata>
              <MetadataItem>
                <strong>{t('Repository:')}</strong> {decodeURIComponent(params.repoName)}
              </MetadataItem>
              <MetadataItem>
                <strong>{t('Files Changed:')}</strong>{' '}
                {prData?.pr_files?.length || prData?.files?.length || 0}
              </MetadataItem>
            </Metadata>
            <PRDetailsCard>
              <PRMeta>
                <PRAuthor>
                  <AuthorAvatar
                    src={prDetails.user.avatar_url}
                    alt={prDetails.user.login}
                  />
                  <AuthorInfo>
                    <AuthorName
                      href={prDetails.user.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {prDetails.user.login}
                    </AuthorName>
                    <PRTimestamp>
                      {t('opened')} {new Date(prDetails.created_at).toLocaleDateString()}
                    </PRTimestamp>
                  </AuthorInfo>
                </PRAuthor>
                <PRBadges>
                  <PRStateBadge state={prDetails.merged_at ? 'merged' : prDetails.state}>
                    {prDetails.merged_at ? 'merged' : prDetails.state}
                  </PRStateBadge>
                  <PRNumber>#{params.prId}</PRNumber>
                </PRBadges>
              </PRMeta>
              {prDetails.body && (
                <PRDescriptionWrapper>
                  <PRDescription
                    isExpanded={expandedDescription}
                    dangerouslySetInnerHTML={{
                      __html: prDetails.body.replace(/\n/g, '<br>'),
                    }}
                  />
                  {!expandedDescription && prDetails.body.length > 100 && (
                    <ExpandButton onClick={() => setExpandedDescription(true)}>
                      {t('See more')}
                    </ExpandButton>
                  )}
                  {expandedDescription && (
                    <ExpandButton onClick={() => setExpandedDescription(false)}>
                      {t('See less')}
                    </ExpandButton>
                  )}
                </PRDescriptionWrapper>
              )}
            </PRDetailsCard>
          </PRTitleSection>
        ) : (
          <FallbackHeader>
            <h1>{t('Pull Request Details')}</h1>
            <Metadata>
              <MetadataItem>
                <strong>{t('Repository:')}</strong> {decodeURIComponent(params.repoName)}
              </MetadataItem>
              <MetadataItem>
                <strong>{t('Files Changed:')}</strong>{' '}
                {prData?.pr_files?.length || prData?.files?.length || 0}
              </MetadataItem>
            </Metadata>
          </FallbackHeader>
        )}
      </Header>
    ),
    [
      prDetails,
      params.repoName,
      params.prId,
      prData?.pr_files?.length,
      prData?.files?.length,
      expandedDescription,
      breadcrumbItems,
    ]
  );

  if (loading) {
    return (
      <Container>
        <LoadingIndicator />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorMessage>{error}</ErrorMessage>
      </Container>
    );
  }

  return (
    <Container>
      {headerSection}

      <TwoColumnLayout>
        <LeftColumn>
          {prData?.pr_files && prData.pr_files.length > 0 && (
            <PRFilesList>
              {prData.pr_files.map((file, index) => {
                const isExpanded = expandedFiles[index] ?? true;

                return (
                  <PRFileItem key={index}>
                    <PRFileHeader onClick={() => toggleFileExpanded(index)}>
                      <PRFileHeaderLeft>
                        <CollapseIcon
                          direction={isExpanded ? 'down' : 'right'}
                          size="xs"
                        />
                        <PRFileName>{file.filename}</PRFileName>
                      </PRFileHeaderLeft>
                      <PRFileStats>
                        <span style={{color: 'green'}}>+{file.additions}</span>
                        <span style={{color: 'red'}}>-{file.deletions}</span>
                        <span>({file.status})</span>
                      </PRFileStats>
                    </PRFileHeader>
                    {isExpanded && file.patch && (
                      <PRFileDiff>
                        <pre>
                          {file.patch.split('\n').map((line, lineIndex) => {
                            let className = 'context';
                            if (line.startsWith('+')) {
                              className = 'addition';
                            } else if (line.startsWith('-')) {
                              className = 'deletion';
                            }
                            return (
                              <span key={lineIndex} className={`diff-line ${className}`}>
                                {line}
                                {lineIndex < (file.patch?.split('\n').length ?? 0) - 1 &&
                                  '\n'}
                              </span>
                            );
                          })}
                        </pre>
                      </PRFileDiff>
                    )}
                  </PRFileItem>
                );
              })}
            </PRFilesList>
          )}

          {prData?.files && prData.files.length > 0 && !prData?.pr_files && (
            <FilesPanel>
              <PanelHeader>{t('Changed Files')}</PanelHeader>
              <PanelBody>
                <FilesList>
                  {prData.files.map((file, index) => (
                    <FileItem key={index}>{file}</FileItem>
                  ))}
                </FilesList>
              </PanelBody>
            </FilesPanel>
          )}
        </LeftColumn>

        <RightColumn>
          <IssuesPanel>
            <PanelHeader>{t('RELATED ISSUES')}</PanelHeader>
            <PanelBody>
              {issuesLoading ? (
                <PlaceholderMessage>{t('Loading issues...')}</PlaceholderMessage>
              ) : issuesError ? (
                <PlaceholderMessage>{issuesError}</PlaceholderMessage>
              ) : issuesData?.issues && issuesData.issues.length > 0 ? (
                <PlaceholderMessage>
                  {t(
                    'Found %s related issues affecting these files',
                    issuesData.issues.length
                  )}
                </PlaceholderMessage>
              ) : (
                <PlaceholderMessage>
                  {t('No issues found affecting these files')}
                </PlaceholderMessage>
              )}
            </PanelBody>
          </IssuesPanel>

          {performanceData && (
            <PerformancePanel>
              <PanelHeader>{t('Performance Impact')}</PanelHeader>
              <PanelBody>
                <PlaceholderMessage>{performanceData.message}</PlaceholderMessage>
              </PanelBody>
            </PerformancePanel>
          )}

          {releasesData && (
            <ReleasesPanel>
              <PanelHeader>{t('Release Information')}</PanelHeader>
              <PanelBody>
                <PlaceholderMessage>{releasesData.message}</PlaceholderMessage>
              </PanelBody>
            </ReleasesPanel>
          )}
        </RightColumn>
      </TwoColumnLayout>
    </Container>
  );
}

const Container = styled('div')`
  padding: ${space(2)} ${space(1.5)};
  max-width: 100%;
  margin: 0;
`;

const Header = styled('div')`
  margin-bottom: ${space(3)};
`;

const BreadcrumbContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const BreadcrumbWithIcon = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const PRTitleSection = styled('div')`
  margin-bottom: ${space(2)};
`;

const TitleRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${space(1)};
`;

const PRTitle = styled('h1')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  color: ${p => p.theme.headingColor};
  line-height: 1.2;
  flex: 1;
  margin-right: ${space(2)};
`;

const ViewOnGitHubLink = styled('a')`
  color: ${p => p.theme.purple300};
  text-decoration: none;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  padding: ${space(0.5)} ${space(1)};
  border: 1px solid ${p => p.theme.purple300};
  border-radius: 4px;
  white-space: nowrap;

  &:hover {
    color: ${p => p.theme.purple400};
    border-color: ${p => p.theme.purple400};
    text-decoration: none;
  }
`;

const PRDetailsCard = styled('div')`
  background: white;
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  padding: ${space(1.5)};
  margin-top: ${space(1)};
`;

const PRMeta = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const PRAuthor = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const AuthorAvatar = styled('img')`
  width: 24px;
  height: 24px;
  border-radius: 50%;
`;

const AuthorInfo = styled('div')`
  display: flex;
  flex-direction: column;
`;

const AuthorName = styled('a')`
  font-weight: 600;
  color: ${p => p.theme.headingColor};
  text-decoration: none;
  font-size: ${p => p.theme.fontSize.sm};

  &:hover {
    color: ${p => p.theme.purple300};
    text-decoration: underline;
  }
`;

const PRTimestamp = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.gray300};
`;

const PRBadges = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const PRStateBadge = styled('span')<{state: 'open' | 'closed' | 'merged'}>`
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: 12px;
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: 600;
  text-transform: capitalize;

  ${p => {
    switch (p.state) {
      case 'open':
        return `
          background-color: #d1f7d1;
          color: #0d5016;
        `;
      case 'closed':
        return `
          background-color: #ffd6d6;
          color: #8b0000;
        `;
      case 'merged':
        return `
          background-color: #e1d5f7;
          color: #5a2d91;
        `;
      default:
        return `
          background-color: ${p.theme.gray100};
          color: ${p.theme.gray400};
        `;
    }
  }}
`;

const PRNumber = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.gray300};
`;

const PRDescriptionWrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding-top: ${space(1)};
  margin-top: ${space(1)};
`;

const PRDescription = styled('div')<{isExpanded: boolean}>`
  color: ${p => p.theme.gray400};
  line-height: 1.5;
  font-size: ${p => p.theme.fontSize.sm};
  ${p =>
    !p.isExpanded &&
    `
    max-height: 100px;
    overflow: hidden;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      height: 20px;
      width: 100%;
      background: linear-gradient(transparent, white);
    }
  `}

  /* Style HTML content */
  br {
    line-height: 1.5;
  }

  p {
    margin: ${space(1)} 0;
    &:first-child {
      margin-top: 0;
    }
    &:last-child {
      margin-bottom: 0;
    }
  }
`;

const ExpandButton = styled('button')`
  background: none;
  border: none;
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  cursor: pointer;
  padding: ${space(0.75)} 0;
  margin-top: ${space(0.75)};
  display: block;
  position: relative;
  z-index: 1;

  &:hover {
    color: ${p => p.theme.purple400};
    text-decoration: underline;
  }
`;

const FallbackHeader = styled('div')`
  margin-bottom: ${space(1)};

  h1 {
    margin: 0;
    color: ${p => p.theme.headingColor};
  }
`;

const Metadata = styled('div')`
  display: flex;
  gap: ${space(3)};
  margin-top: ${space(1)};
  color: ${p => p.theme.gray300};
`;

const MetadataItem = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const TwoColumnLayout = styled('div')`
  display: flex;
  gap: ${space(3)};
  margin-bottom: ${space(2)};
`;

const LeftColumn = styled('div')`
  flex: 2;
  min-width: 0;
`;

const RightColumn = styled('div')`
  flex: 1;
  min-width: 0;
`;

const FilesPanel = styled(Panel)`
  margin-bottom: ${space(2)};
`;

const PRFilesList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const PRFileItem = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: 6px;
  background: ${p => p.theme.background};
`;

const PRFileHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  cursor: pointer;
  user-select: none;

  &:hover {
    background: ${p => p.theme.gray100};
  }
`;

const PRFileHeaderLeft = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CollapseIcon = styled(IconChevron)`
  color: ${p => p.theme.gray300};
  transition: transform 0.2s ease;
`;

const PRFileName = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
`;

const PRFileStats = styled('div')`
  display: flex;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSize.xs};
  font-family: ${p => p.theme.text.familyMono};
`;

const PRFileDiff = styled('div')`
  background: white;

  pre {
    margin: 0;
    padding: 0;
    font-size: ${p => p.theme.fontSize.xs};
    font-family: ${p => p.theme.text.familyMono};
    white-space: pre;
    overflow-x: auto;
    background: white;

    .diff-line {
      display: block;
      padding: 1px 8px;
      margin: 0;
      line-height: 1.4;

      &.addition {
        background-color: #d1f2d1;
        color: #0c5912;
      }

      &.deletion {
        background-color: #ffd6d6;
        color: #8b0000;
      }

      &.context {
        background-color: white;
        color: #24292f;
      }
    }
  }
`;

const FilesList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const FileItem = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.gray100};
  border-radius: 3px;
`;

const IssuesPanel = styled(Panel)`
  margin-bottom: ${space(2)};
`;

const PerformancePanel = styled(Panel)`
  margin-bottom: ${space(2)};
`;

const ReleasesPanel = styled(Panel)`
  margin-bottom: ${space(2)};
`;

const ErrorMessage = styled('div')`
  color: ${p => p.theme.red300};
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.red200};
  border-radius: 6px;
  background: ${p => p.theme.red100};
`;

const PlaceholderMessage = styled('div')`
  color: ${p => p.theme.gray300};
  font-style: italic;
  padding: ${space(2)};
`;
