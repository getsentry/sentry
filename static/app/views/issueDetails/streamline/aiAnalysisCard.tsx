import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';
import type {
  AutofixCodebaseChange,
  AutofixRootCauseData,
} from 'sentry/components/events/autofix/types';
import {
  getRootCauseDescription,
  getRootCauseIsLoading,
} from 'sentry/components/events/autofix/utils';
import {useGroupSummaryData} from 'sentry/components/group/groupSummary';
import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import GroupChart from 'sentry/components/stream/groupChart';
import {
  IconChat,
  IconChevron,
  IconCode,
  IconFocus,
  IconSeer,
  IconTerminal,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor, TimeseriesValue} from 'sentry/types/core';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {GroupStatus} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';
import useApi from 'sentry/utils/useApi';
import {useApiQuery} from 'sentry/utils/queryClient';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {EventDetails} from 'sentry/views/issueDetails/streamline/eventDetails';
import {EventDetailsHeader} from 'sentry/views/issueDetails/streamline/eventDetailsHeader';
import {useIssueDetailsDiscoverQuery} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/sidebar/activitySection';
import ParticipantList from 'sentry/views/issueDetails/streamline/sidebar/participantList';

function ChartsSection({group}: {group: Group}) {
  const organization = useOrganization();
  const location = useLocation();
  const config = getConfigForIssueType(group, group.project);

  // Create EventView for 24 hours
  const eventView24h = useMemo(() => {
    const view = EventView.fromSavedQuery({
      statsPeriod: '24h',
      dataset: config.usesIssuePlatform ? DiscoverDatasets.ISSUE_PLATFORM : DiscoverDatasets.ERRORS,
      version: 2,
      projects: [Number(group.project.id)],
      yAxis: ['count()'],
      fields: ['title', 'timestamp'],
      name: `${group.title || group.type} - 24h`,
      query: `issue:${group.shortId}`,
      interval: '1h',
    });
    // Override location-based filters to ensure we get 24h data
    view.statsPeriod = '24h';
    view.start = undefined;
    view.end = undefined;
    return view;
  }, [group.shortId, group.title, group.type, group.project.id, config.usesIssuePlatform]);

  // Create EventView for 30 days  
  const eventView30d = useMemo(() => {
    const view = EventView.fromSavedQuery({
      statsPeriod: '30d',
      dataset: config.usesIssuePlatform ? DiscoverDatasets.ISSUE_PLATFORM : DiscoverDatasets.ERRORS,
      version: 2,
      projects: [Number(group.project.id)],
      yAxis: ['count()'],
      fields: ['title', 'timestamp'],
      name: `${group.title || group.type} - 30d`,
      query: `issue:${group.shortId}`,
      interval: '1d',
    });
    // Override location-based filters to ensure we get 30d data
    view.statsPeriod = '30d';
    view.start = undefined;
    view.end = undefined;
    return view;
  }, [group.shortId, group.title, group.type, group.project.id, config.usesIssuePlatform]);

  const {data: stats24h, isPending: loading24h, error: error24h} = useIssueDetailsDiscoverQuery<MultiSeriesEventsStats>({
    params: {
      route: 'events-stats',
      eventView: eventView24h,
      referrer: 'issue_details.charts_24h',
    },
  });

  const {data: stats30d, isPending: loading30d, error: error30d} = useIssueDetailsDiscoverQuery<MultiSeriesEventsStats>({
    params: {
      route: 'events-stats',
      eventView: eventView30d,
      referrer: 'issue_details.charts_30d',
    },
  });

  // Debug logging
  console.log('Charts Debug:', {
    stats24h,
    stats30d,
    loading24h,
    loading30d,
    error24h,
    error30d,
    eventView24h: eventView24h.getEventsAPIPayload(location),
    eventView30d: eventView30d.getEventsAPIPayload(location),
  });

  // Convert data to TimeseriesValue[] format
  const convert24hStats: TimeseriesValue[] = stats24h?.data?.map(([timestamp, countData]) => [
    timestamp,
    countData?.[0]?.count ?? 0
  ]) || [];
  
  const convert30dStats: TimeseriesValue[] = stats30d?.data?.map(([timestamp, countData]) => [
    timestamp, 
    countData?.[0]?.count ?? 0
  ]) || [];

  console.log('Converted stats:', { convert24hStats, convert30dStats });

  return (
    <ChartsMetricsSection>
      <ChartContainer>
        <ChartTitle>{t('Last 24 Hours')}</ChartTitle>
        {loading24h ? (
          <div style={{height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'}}>
            Loading...
          </div>
        ) : error24h ? (
          <div style={{height: 48, display: 'flex', alignItems: 'center', color: 'red', fontSize: '12px'}}>
            Error
          </div>
        ) : (
          <GroupChart stats={convert24hStats} height={48} />
        )}
      </ChartContainer>
      <ChartContainer>
        <ChartTitle>{t('Last 30 Days')}</ChartTitle>
        {loading30d ? (
          <div style={{height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'}}>
            Loading...
          </div>
        ) : error30d ? (
          <div style={{height: 48, display: 'flex', alignItems: 'center', color: 'red', fontSize: '12px'}}>
            Error
          </div>
        ) : (
          <GroupChart stats={convert30dStats} height={48} />
        )}
      </ChartContainer>
    </ChartsMetricsSection>
  );
}

interface AIAnalysisCardProps {
  event: Event | null;
  group: Group;
  project: Project;
}

interface SeverityAnalysis {
  impact: {
    description: string;
  };
  metrics: {
    events: {
      count: number;
      timeframe: string;
    };
    failureRate: {
      percentage: number;
      unit: string;
    };
    usersAffected: {
      count: number | string;
      label: string;
    };
  };
  reasoning: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  timeline: {
    firstSeen: string;
    lastSeen: string;
  };
  title: string;
  volume: {
    reach: string;
    trending: string;
  };
}

interface AutofixResponse {
  autofix: {
    run_id: string;
    status: 'COMPLETED' | 'PENDING' | 'FAILED';
    steps: Array<{
      key: string;
      status: 'COMPLETED' | 'PENDING' | 'FAILED';
      title: string;
      causes?: AutofixRootCauseData[];
      changes?: AutofixCodebaseChange[];
    }>;
  };
}

interface AnalysisData {
  analysis: SeverityAnalysis;
  success: boolean;
  timestamp: string;
  error?: string;
}

export function AIAnalysisCard({group, event, project}: AIAnalysisCardProps) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [autofixData, setAutofixData] = useState<AutofixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showRootCauseReasoning, setShowRootCauseReasoning] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [orgMembers, setOrgMembers] = useState<User[]>([]);
  const [sentryApiToken, setSentryApiToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInputValue, setTokenInputValue] = useState<string>('');
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [similarIssuesCount, setSimilarIssuesCount] = useState<number>(0);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const isAIMode = searchParams.get('aiMode') === 'true';

  // Get initial guess from group summary - must be called at top level for hooks order
  const {data: summaryData} = useGroupSummaryData(group);

  const api = useApi();
  const organization = useOrganization();
  const activeUser = useUser();

  const toggleAIMode = () => {
    const newQuery = {...location.query};
    if (isAIMode) {
      delete newQuery.aiMode;
    } else {
      newQuery.aiMode = 'true';
    }
    navigate({
      ...location,
      query: newQuery,
    });
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleStatusChange = async (newStatus: GroupStatus) => {
    try {
      await api.requestPromise(
        `/organizations/${organization.slug}/issues/${group.id}/`,
        {
          method: 'PUT',
          data: {status: newStatus},
        }
      );
      setShowStatusDropdown(false);
      // The parent component should re-fetch data to update the UI
      window.location.reload(); // Simple reload for now
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const fetchOrgMembers = async () => {
    try {
      const members = await api.requestPromise(
        `/organizations/${organization.slug}/members/`
      );
      setOrgMembers(members.map((member: any) => member.user));
    } catch (err) {
      console.error('Failed to fetch org members:', err);
    }
  };

  const handleAssigneeChange = async (assignee: Actor | null) => {
    try {
      await api.requestPromise(
        `/organizations/${organization.slug}/issues/${group.id}/`,
        {
          method: 'PUT',
          data: {assignedTo: assignee ? `user:${assignee.id}` : ''},
        }
      );
      setShowAssigneeDropdown(false);
      // The parent component should re-fetch data to update the UI
      window.location.reload(); // Simple reload for now
    } catch (err) {
      console.error('Failed to update assignee:', err);
    }
  };

  const handleSaveToken = () => {
    if (tokenInputValue.trim()) {
      localStorage.setItem('sentryApiToken', tokenInputValue.trim());
      setSentryApiToken(tokenInputValue.trim());
      setShowTokenInput(false);
      // Auto-fetch analysis after saving token
      if (isAIMode && !analysisData && !loading) {
        fetchAnalysis();
      }
    }
  };

  const handleClearToken = () => {
    localStorage.removeItem('sentryApiToken');
    setSentryApiToken('');
    setTokenInputValue('');
    setShowTokenInput(true);
    setAnalysisData(null);
  };

  const formatAssignee = (assignedTo: Actor | null) => {
    if (!assignedTo) return 'Unassigned';
    return assignedTo.name;
  };

  const {userParticipants, teamParticipants, viewers} = useMemo(() => {
    return {
      userParticipants: group.participants.filter(
        (p): p is UserParticipant => p.type === 'user'
      ),
      teamParticipants: group.participants.filter(
        (p): p is TeamParticipant => p.type === 'team'
      ),
      viewers: group.seenBy.filter(user => activeUser.id !== user.id),
    };
  }, [group, activeUser.id]);

  const showPeopleSection = group.participants.length > 0 || viewers.length > 0;

  // Load token from localStorage on mount and initialize token state
  useEffect(() => {
    const savedToken = localStorage.getItem('sentryApiToken');
    if (savedToken) {
      setSentryApiToken(savedToken);
      setTokenInputValue(savedToken);
    }
    setHasLoadedFromStorage(true);
  }, []);

  // Auto-fetch analysis when component mounts in AI mode (if token is available)
  useEffect(() => {
    // Only proceed after we've loaded from localStorage
    if (!hasLoadedFromStorage) return;

    if (isAIMode && !analysisData && !loading && !error) {
      if (sentryApiToken) {
        fetchAnalysis();
      } else {
        setShowTokenInput(true);
      }
    }
  }, [isAIMode, sentryApiToken, analysisData, loading, error, hasLoadedFromStorage]); // Include hasLoadedFromStorage dependency

  // Fetch organization members for assignee dropdown
  useEffect(() => {
    if (orgMembers.length === 0) {
      fetchOrgMembers();
    }
  }, []);

  const startAutofix = async () => {
    try {
      console.log('Starting autofix for issue', group.id);
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
        {
          method: 'POST',
          data: {
            event_id: event?.id || null,
            instruction: '', // Empty instruction for default behavior
          },
        }
      );
      console.log('Autofix started with run_id:', response.run_id);
      // The autofix data will be fetched in subsequent polls
    } catch (err) {
      console.error('Failed to start autofix:', err);
    }
  };

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if we have a token before making the request
      if (!sentryApiToken) {
        setShowTokenInput(true);
        throw new Error('Sentry API token is required');
      }

      // Fetch both severity analysis and autofix data in parallel
      const [severityPromise, autofixPromise] = await Promise.allSettled([
        // Use fetch for our external severity API with Authorization header
        fetch(`http://localhost:3001/api/severity-agent/${group.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sentryApiToken}`,
          },
        }),
        // Use Sentry's authenticated API for autofix data
        api.requestPromise(
          `/organizations/${organization.slug}/issues/${group.id}/autofix/`
        ),
      ]);

      // Handle severity analysis
      if (severityPromise.status === 'fulfilled' && severityPromise.value.ok) {
        const severityData = await severityPromise.value.json();
        setAnalysisData(severityData);
      } else {
        throw new Error('Failed to fetch AI analysis');
      }

      // Handle autofix data (optional)
      if (autofixPromise.status === 'fulfilled') {
        const autofixResponseData = autofixPromise.value as AutofixResponse;

        // Check if autofix is null (no existing run)
        if (autofixResponseData?.autofix) {
          setAutofixData(autofixResponseData);
        } else {
          console.log('No existing autofix run found, starting autofix...');
          await startAutofix();
        }
      } else {
        console.log('Autofix API call failed, trying to start autofix...');
        // Automatically start autofix if API call failed (likely means no existing run)
        await startAutofix();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Don't show full loading screen - we'll populate with real data immediately

  if (error && !analysisData) {
    return (
      <AILayoutContainer>
        <ErrorCard>
          <CardHeader>
            <CardTitle>
              <IconSeer size="md" />
              {t('AI Analysis')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorMessage>{t('Failed to load analysis: %s', error)}</ErrorMessage>
            <Button onClick={fetchAnalysis} size="sm">
              {t('Retry')}
            </Button>
          </CardContent>
        </ErrorCard>
      </AILayoutContainer>
    );
  }

  // Show token input if no analysis data and token input is required
  if (showTokenInput || (!analysisData && !sentryApiToken)) {
    return (
      <AILayoutContainer>
        <GetStartedCard>
          <CardHeader>
            <CardTitle>
              <IconSeer size="md" />
              {t('AI Analysis')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <P>
              {t(
                'To use AI analysis, please provide your Sentry API token. You can find your token in Sentry Settings > Auth Tokens.'
              )}
            </P>
            <TokenInputContainer>
              <TokenInput
                type="password"
                placeholder="Enter your Sentry API token..."
                value={tokenInputValue}
                onChange={e => setTokenInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSaveToken();
                  }
                }}
              />
              <Button
                onClick={handleSaveToken}
                priority="primary"
                size="sm"
                disabled={!tokenInputValue.trim()}
              >
                {t('Save Token')}
              </Button>
            </TokenInputContainer>
            {sentryApiToken && (
              <TokenActions>
                <Button onClick={handleClearToken} size="xs" priority="default">
                  {t('Clear Saved Token')}
                </Button>
              </TokenActions>
            )}
          </CardContent>
        </GetStartedCard>
      </AILayoutContainer>
    );
  }

  // Removed the "Run AI Analysis" button screen - now auto-start analysis and show loading states

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return {
          background: 'linear-gradient(135deg, #FA4E61 0%, #E91E3A 100%)',
          text: '#FFFFFF',
        };
      case 'high':
        return {
          background: 'linear-gradient(135deg, #FF8C73 0%, #FF6B50 100%)',
          text: '#FFFFFF',
        };
      case 'medium':
        return {
          background: 'linear-gradient(135deg, #FFC854 0%, #FFAE33 100%)',
          text: '#3E2723',
        };
      case 'low':
        return {
          background: 'linear-gradient(135deg, #8FD4A8 0%, #6FBF8C 100%)',
          text: '#FFFFFF',
        };
      default:
        return {
          background: '#E9EBEF',
          text: '#3E3446',
        };
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  };

  // Get root cause data from autofix response
  const getRootCauseData = (): {causes: AutofixRootCauseData[]; runId: string} | null => {
    if (!autofixData?.autofix?.steps || !autofixData.autofix.run_id) return null;

    const rootCauseStep = autofixData.autofix.steps.find(
      step => step.key === 'root_cause_analysis'
    );

    return rootCauseStep?.causes
      ? {
          causes: rootCauseStep.causes,
          runId: autofixData.autofix.run_id,
        }
      : null;
  };

  // Get solution data from autofix response
  const getSolutionData = (): {
    changes: AutofixCodebaseChange[];
    runId: string;
  } | null => {
    if (!autofixData?.autofix?.steps || !autofixData.autofix.run_id) return null;

    const changesStep = autofixData.autofix.steps.find(step => step.key === 'changes');

    return changesStep?.changes
      ? {
          changes: changesStep.changes,
          runId: autofixData.autofix.run_id,
        }
      : null;
  };

  const rootCauseData = getRootCauseData();
  const solutionData = getSolutionData();
  
  // Get root cause description and loading state using the utility functions
  const rootCauseDescription = autofixData?.autofix ? getRootCauseDescription(autofixData.autofix) : null;
  const rootCauseIsLoading = autofixData?.autofix ? getRootCauseIsLoading(autofixData.autofix) : false;
  
  // Get initial guess from group summary data (hook called at top level)
  const initialGuess = summaryData?.possibleCause;

  return (
    <AILayoutContainer>
      <MainContent>
        {/* Header Section - Use real group data immediately */}
        <HeaderCard>
          <CardContent>
            {/* Issue Title - Use AI title once available, fallback to group title */}
            <IssueTitle>
              {analysisData?.success ? analysisData.analysis.title : group.title}
            </IssueTitle>

            {/* Timeline and Metrics Row - Use real group data */}
            <TimelineMetricsRow>
              <TimelineMetricsContent>
                <TimelineSection>
                  <TimelineItem>
                    <TimelineLabel>{t('First seen:')}</TimelineLabel>
                    <TimelineValue>
                      {formatTimeAgo(group.firstSeen)}
                    </TimelineValue>
                  </TimelineItem>
                  <TimelineItem>
                    <TimelineLabel>{t('Last seen:')}</TimelineLabel>
                    <TimelineValue>
                      {formatTimeAgo(group.lastSeen)}
                    </TimelineValue>
                  </TimelineItem>
                </TimelineSection>

                <MetricsSection>
                  <MetricItem>
                    <MetricLabel>{t('Events')}</MetricLabel>
                    <MetricValue>
                      {group.count}
                    </MetricValue>
                  </MetricItem>

                  <MetricItem>
                    <MetricLabel>{t('Users Affected')}</MetricLabel>
                    <MetricValue>
                      {group.userCount}
                    </MetricValue>
                  </MetricItem>
                </MetricsSection>
              </TimelineMetricsContent>
            </TimelineMetricsRow>

          </CardContent>
        </HeaderCard>

        <SeverityCard>
          <SeverityCardHeader 
            severityColor={analysisData?.success ? getSeverityColor(analysisData.analysis.severity).background : 'transparent'}
            isLoading={!analysisData?.success}
          >
            <HeaderLeft>
              {analysisData?.success ? (
                <SeverityPill colors={getSeverityColor(analysisData.analysis.severity)}>
                  {analysisData.analysis.severity}
                </SeverityPill>
              ) : (
                <LoadingSeverityPill>
                  <LoadingIndicator mini size={16} />
                  {t('Analyzing...')}
                </LoadingSeverityPill>
              )}
              <CardTitle>
                <IconSeer size="md" />
                {t('Severity')}
              </CardTitle>
            </HeaderLeft>
          </SeverityCardHeader>

          <CardContent>
            {analysisData?.success ? (
              <Fragment>
                {/* Analysis Sections */}
                <AnalysisSection>
                  <SectionTitle>{t('Impact')}</SectionTitle>
                  <ImpactContent>
                    {analysisData.analysis.impact.description
                      .split('•')
                      .filter(Boolean)
                      .map((point, index) => (
                        <ImpactPoint key={index}>• {point.trim()}</ImpactPoint>
                      ))}
                  </ImpactContent>
                </AnalysisSection>

                <AnalysisSection>
                  <SectionTitle>{t('Status')}</SectionTitle>
                  <VolumeContent>
                    <VolumeItem>
                      <strong>{t('Trending:')}</strong>{' '}
                      {analysisData.analysis.volume.trending}
                    </VolumeItem>
                    <VolumeItem>
                      <strong>{t('Reach:')}</strong> {analysisData.analysis.volume.reach}
                    </VolumeItem>
                  </VolumeContent>
                </AnalysisSection>

                <AnalysisSection>
                  <CollapsibleSectionHeader
                    onClick={() => setShowReasoning(!showReasoning)}
                  >
                    <ChevronIcon direction={showReasoning ? 'down' : 'right'}>
                      <IconChevron />
                    </ChevronIcon>
                    <SectionTitle>{t('Reasoning')}</SectionTitle>
                  </CollapsibleSectionHeader>
                  {showReasoning && (
                    <ReasoningContent>{analysisData.analysis.reasoning}</ReasoningContent>
                  )}
                </AnalysisSection>
              </Fragment>
            ) : error && !loading ? (
              <ErrorMessage>
                {t('Severity assessment failed: %s', error)}
              </ErrorMessage>
            ) : (
              <Fragment>
                {/* Show loading states for AI-generated sections */}
                <AnalysisSection>
                  <SectionTitle>{t('Impact')}</SectionTitle>
                  <LoadingText>
                    <em>{t('Seer is analyzing your issue now...')}</em>
                  </LoadingText>
                </AnalysisSection>

                <AnalysisSection>
                  <SectionTitle>{t('Status')}</SectionTitle>
                  <LoadingText>
                    <em>{t('Seer is analyzing your issue now...')}</em>
                  </LoadingText>
                </AnalysisSection>

                <AnalysisSection>
                  <SectionTitle>{t('Reasoning')}</SectionTitle>
                  <LoadingText>
                    <em>{t('Seer is analyzing your issue now...')}</em>
                  </LoadingText>
                </AnalysisSection>
              </Fragment>
            )}
          </CardContent>
        </SeverityCard>

        {/* Root Cause Analysis Section - Always show this card */}
        <RootCauseWrapper>
          <RootCauseCard>
            <CardHeader>
              <HeaderLeft>
                <CardTitle>
                  <IconFocus size="md" />
                  {t('Root Cause')}
                </CardTitle>
                {rootCauseIsLoading && (
                  <StatusPill>
                    <LoadingIndicator mini size={16} />
                    {t('In Progress')}
                  </StatusPill>
                )}
              </HeaderLeft>
            </CardHeader>

            <CardContent>
              {rootCauseIsLoading ? (
                <ProgressContainer>
                  <ProgressIndicator>
                    <LoadingIndicator />
                    <ProgressText>
                      {t('Seer is analyzing the root cause of this issue...')}
                    </ProgressText>
                  </ProgressIndicator>
                </ProgressContainer>
              ) : rootCauseDescription ? (
                <>
                  {/* Root Cause Description */}
                  <RootCauseDescription>
                    {rootCauseDescription}
                  </RootCauseDescription>

                  <AnalysisSection>
                    <CollapsibleSectionHeader
                      onClick={() => setShowRootCauseReasoning(!showRootCauseReasoning)}
                    >
                      <ChevronIcon direction={showRootCauseReasoning ? 'down' : 'right'}>
                        <IconChevron />
                      </ChevronIcon>
                      <SectionTitle>{t('Reasoning')}</SectionTitle>
                    </CollapsibleSectionHeader>
                    {showRootCauseReasoning && rootCauseData && (
                      <RootCauseContent>
                        <AutofixRootCause
                          causes={rootCauseData.causes}
                          groupId={group.id}
                          runId={rootCauseData.runId}
                          rootCauseSelection={null}
                          event={event}
                        />
                      </RootCauseContent>
                    )}
                  </AnalysisSection>
                </>
              ) : initialGuess ? (
                <InitialGuessContainer>
                  <InitialGuessLabel>{t('Initial Guess')}</InitialGuessLabel>
                  <InitialGuessContent>
                    {initialGuess}
                  </InitialGuessContent>
                </InitialGuessContainer>
              ) : (
                <EmptyStateText>
                  {t('No root cause analysis available. Start Seer to analyze this issue.')}
                </EmptyStateText>
              )}
            </CardContent>
          </RootCauseCard>
        </RootCauseWrapper>

        {/* Solution Section */}
        {solutionData && (
          <SolutionWrapper>
            <SolutionCard>
              <CardHeader>
                <HeaderLeft>
                  <CardTitle>
                    <IconCode size="md" color="green400" />
                    {t('Solution')}
                  </CardTitle>
                </HeaderLeft>
              </CardHeader>

              <CardContent>
                <SolutionContent>
                  <AutofixChanges
                    step={{
                      id: 'changes',
                      index: 0,
                      progress: [],
                      status: 'COMPLETED' as const,
                      title: 'Changes',
                      type: 'changes' as const,
                      changes: solutionData.changes,
                    }}
                    groupId={group.id}
                    runId={solutionData.runId}
                  />
                </SolutionContent>
              </CardContent>
            </SolutionCard>
          </SolutionWrapper>
        )}

        {/* Debugger Section */}
        <DebuggerWrapper isExpanded={showDebugger}>
          <DebuggerCard>
            <CardHeader>
              <DebuggerHeaderContent onClick={() => setShowDebugger(!showDebugger)}>
                <HeaderLeft>
                  <CardTitle>
                    <IconTerminal size="md" color="purple400" />
                    {t('Debugger')}
                  </CardTitle>
                  <DebuggerSubtitle>{t('Event Details & Tools')}</DebuggerSubtitle>
                  <ChevronIcon direction={showDebugger ? 'down' : 'left'}>
                    <IconChevron />
                  </ChevronIcon>
                </HeaderLeft>
                <HeaderRight />
              </DebuggerHeaderContent>
            </CardHeader>

            <CardContent>
              {showDebugger && event && (
                <DebuggerContent>
                  <EventDetailsHeader event={event} group={group} project={project} />
                  <EventDetails event={event} group={group} project={project} />
                </DebuggerContent>
              )}
              {showDebugger && !event && (
                <DebuggerContent>
                  <div>No event data available for debugging</div>
                </DebuggerContent>
              )}
            </CardContent>
          </DebuggerCard>
        </DebuggerWrapper>

        {/* Activity Section */}
        <ActivityWrapper>
          <ActivityCard>
            <CardHeader>
              <HeaderLeft>
                <CardTitle>
                  <IconChat size="md" />
                  {t('Activity')}
                </CardTitle>
              </HeaderLeft>
            </CardHeader>

            <CardContent>
              <StreamlinedActivitySection group={group} isDrawer />
            </CardContent>
          </ActivityCard>
        </ActivityWrapper>
      </MainContent>

      <Sidebar>
        <SidebarCard>
          <CardContent>
{!isAIMode && (
              <Button
                size="xs"
                priority="default"
                onClick={toggleAIMode}
                icon={<span>🤖</span>}
                title={t('Toggle AI-powered analysis of this issue')}
                aria-label={t('Toggle AI analysis mode')}
              >
                {t('Seer Mode: OFF')}
              </Button>
            )}

            <StatusSection>
              <StatusLabel>Status:</StatusLabel>
              <StatusDisplay
                onMouseEnter={() => setShowStatusDropdown(true)}
                onMouseLeave={() => setShowStatusDropdown(false)}
              >
                <StatusText>{formatStatus(group.status)}</StatusText>
                {showStatusDropdown && (
                  <StatusDropdown>
                    {Object.values(GroupStatus)
                      .filter(status => status !== group.status)
                      .map(status => (
                        <StatusOption
                          key={status}
                          onClick={() => handleStatusChange(status)}
                        >
                          {formatStatus(status)}
                        </StatusOption>
                      ))}
                  </StatusDropdown>
                )}
              </StatusDisplay>
            </StatusSection>

            <StatusSection>
              <StatusLabel>Assigned:</StatusLabel>
              <StatusDisplay
                onMouseEnter={() => setShowAssigneeDropdown(true)}
                onMouseLeave={() => setShowAssigneeDropdown(false)}
              >
                <StatusText>{formatAssignee(group.assignedTo)}</StatusText>
                {showAssigneeDropdown && (
                  <StatusDropdown>
                    {!group.assignedTo && (
                      <StatusOption onClick={() => handleAssigneeChange(null)}>
                        {t('Unassigned')}
                      </StatusOption>
                    )}
                    {orgMembers
                      .filter(
                        member => !group.assignedTo || member.id !== group.assignedTo.id
                      )
                      .map(member => (
                        <StatusOption
                          key={member.id}
                          onClick={() =>
                            handleAssigneeChange({
                              id: member.id,
                              name: member.name || member.email,
                              type: 'user',
                              email: member.email,
                            })
                          }
                        >
                          {member.name || member.email}
                        </StatusOption>
                      ))}
                    {group.assignedTo && (
                      <StatusOption onClick={() => handleAssigneeChange(null)}>
                        {t('Unassign')}
                      </StatusOption>
                    )}
                  </StatusDropdown>
                )}
              </StatusDisplay>
            </StatusSection>

            {event && (
              <IssueTrackingSection>
                <IssueTrackingLabel>{t('Issue Tracking:')}</IssueTrackingLabel>
                <IssueTrackingContent>
                  <StreamlinedExternalIssueList
                    group={group}
                    event={event}
                    project={project}
                  />
                </IssueTrackingContent>
              </IssueTrackingSection>
            )}

            {showPeopleSection && (
              <PeopleSection>
                <PeopleLabel>{t('People:')}</PeopleLabel>
                <PeopleContent>
                  {(userParticipants.length > 0 || teamParticipants.length > 0) && (
                    <PeopleRow>
                      <ParticipantList
                        users={userParticipants}
                        teams={teamParticipants}
                        hideTimestamp
                      />
                      <PeopleLabel>{t('participating')}</PeopleLabel>
                    </PeopleRow>
                  )}
                  {viewers.length > 0 && (
                    <PeopleRow>
                      <ParticipantList users={viewers} />
                      <PeopleLabel>{t('viewed')}</PeopleLabel>
                    </PeopleRow>
                  )}
                </PeopleContent>
              </PeopleSection>
            )}

            <SimilarIssuesSection 
              group={group} 
              onSimilarIssuesCountChange={setSimilarIssuesCount}
            />

            <ActionItemsSection similarIssuesCount={similarIssuesCount} />

            <ChartsSection group={group} />
            
            {isAIMode && (
              <ExitAIModeLink onClick={toggleAIMode}>
                {t('Exit Seer Mode')}
              </ExitAIModeLink>
            )}
          </CardContent>
        </SidebarCard>
      </Sidebar>
    </AILayoutContainer>
  );
}

const AILayoutContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(3)};
  padding: ${space(2)} 0;
  padding-right: 340px; /* Account for 320px sidebar + gap */
  align-items: flex-start;
`;

const MainContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  flex: 1;
  align-items: center;
`;

const Sidebar = styled('div')`
  width: 320px;
  flex-shrink: 0;
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  z-index: 100;
  background: ${p => p.theme.background};
  border-left: 1px solid ${p => p.theme.border};
`;

const SidebarCard = styled(Card)`
  height: 100%;
  border-radius: 0;
  border: none;
  border-left: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: column;
`;

const HeaderCard = styled(Card)`
  max-width: 768px;
  width: 100%;
  border: none;
  margin-bottom: ${space(1.5)};
`;

const SeverityCard = styled(Card)`
  max-width: 768px;
  width: 100%;
  margin-top: -${space(1.5)};
`;

const AnalysisCard = styled(Card)`
  margin-bottom: ${space(2)};
  max-width: 768px;
`;

const GetStartedCard = styled(AnalysisCard)`
  border-color: ${p => p.theme.purple300};
`;

const ErrorCard = styled(AnalysisCard)`
  border-color: ${p => p.theme.error};
`;

const CardHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1.5)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SeverityCardHeader = styled('div')<{severityColor: string; isLoading: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1.5)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  position: relative;
  
  /* Apply subtle gradient background */
  ${p => !p.isLoading && `
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${p.severityColor};
      opacity: 0.08;
      pointer-events: none;
    }
  `}
  
  /* Keep text dark for better readability with subtle background */
  color: ${p => p.isLoading ? 'inherit' : p.theme.textColor};
  
  /* Ensure child elements maintain proper contrast */
  ${p => !p.isLoading && `
    h3, span {
      color: ${p.theme.textColor} !important;
    }
    
    svg {
      color: ${p.theme.textColor};
    }
  `}
`;

const CardTitle = styled('h3')`
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: 600;
  color: ${p => p.theme.headingColor};
`;

const CardContent = styled('div')`
  padding: ${space(2)};
`;

const LoadingText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  margin: ${space(1)} 0;
  padding: ${space(1)};
  text-align: left;
  line-height: 1.4;
  
  em {
    font-style: italic;
  }
`;

const ErrorMessage = styled('div')`
  color: ${p => p.theme.error};
  margin-bottom: ${space(2)};
`;

const H2 = styled('h2')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: ${space(2)} 0 ${space(1)} 0;
`;

const H3 = styled('h3')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: ${space(1.5)} 0 ${space(1)} 0;
`;

const H4 = styled('h4')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: ${space(1)} 0 ${space(0.5)} 0;
`;

const H5 = styled('h5')`
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: ${space(1)} 0 ${space(0.5)} 0;
`;

const P = styled('p')`
  margin: ${space(1)} 0;
  line-height: 1.5;
`;

const Li = styled('li')`
  margin: ${space(0.5)} 0;
  margin-left: ${space(2)};
`;

const CodeBlock = styled('pre')`
  background: ${p => p.theme.gray100};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  margin: ${space(1)} 0;
  overflow-x: auto;
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
`;

// New styled components for severity card
const HeaderLeft = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1.5)};
`;

const StatusPill = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  border-radius: 12px;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  border: 1px solid ${p => p.theme.border};
`;

const SeverityPill = styled('span')<{colors: {background: string; text: string}}>`
  display: inline-flex;
  align-items: center;
  padding: ${space(0.5)} ${space(1.5)};
  border-radius: 20px;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: ${p => p.colors.background};
  color: ${p => p.colors.text};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: transform 0.1s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  }
`;

const LoadingSeverityPill = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1.5)};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  border-radius: 20px;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
  border: 1px solid ${p => p.theme.border};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
`;

const IssueTitle = styled('h4')`
  margin: 0 0 ${space(2)} 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  line-height: 1.3;
`;

const TimelineMetricsRow = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  margin-left: -${space(2)};
  margin-right: -${space(2)};
  padding: ${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
`;

const TimelineMetricsContent = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(3)};
`;

const TimelineSection = styled('div')`
  display: flex;
  gap: ${space(3)};
`;

const TimelineItem = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const TimelineLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const TimelineValue = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const MetricsSection = styled('div')`
  display: flex;
  gap: ${space(3)};
  align-items: flex-start;
`;

const MetricItem = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const MetricLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-bottom: ${space(0.5)};
`;

const MetricValue = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
  display: flex;
  flex-direction: column;
  line-height: 1.2;
`;

const MetricSubtitle = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
  margin-top: ${space(0.5)};
`;

const AnalysisSection = styled('div')`
  margin-bottom: ${space(2)};
  padding-bottom: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
`;

const SectionTitle = styled('h5')`
  margin: 0 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  color: ${p => p.theme.gray400};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SectionContent = styled('p')`
  margin: 0;
  line-height: 1.6;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.md};
`;

const ImpactContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
`;

const ImpactPoint = styled('div')`
  line-height: 1.6;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.md};
`;

const VolumeContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const VolumeItem = styled('div')`
  line-height: 1.5;
  color: ${p => p.theme.textColor};
`;

const RootCauseWrapper = styled('div')`
  max-width: 768px;
  width: 100%;
`;

const RootCauseCard = styled(Card)`
  width: 100%;
`;

const CollapsibleSectionHeader = styled('button')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  width: 100%;
  padding: 0;
  margin: 0;
  background: none;
  border: none;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }

  ${SectionTitle} {
    margin-bottom: 0;
  }
`;

const ChevronIcon = styled('span')<{direction: 'down' | 'right'}>`
  display: flex;
  align-items: center;
  transition: transform 0.2s ease;
  transform: ${p => (p.direction === 'down' ? 'rotate(0)' : 'rotate(-90deg)')};
  color: ${p => p.theme.gray300};

  svg {
    width: 16px;
    height: 16px;
  }
`;

const ReasoningContent = styled(SectionContent)`
  margin-top: ${space(1)};
  padding: ${space(1.5)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border-left: 3px solid ${p => p.theme.purple300};
`;

const StatusSection = styled('div')`
  margin-top: ${space(2)};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StatusLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
  min-width: 60px;
  display: inline-block;
`;

const StatusDisplay = styled('div')`
  position: relative;
  display: inline-block;
`;

const StatusText = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeight.bold};
  cursor: pointer;
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  transition: background 0.2s ease;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const StatusDropdown = styled('div')`
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 120px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  overflow: hidden;
`;

const StatusOption = styled('div')`
  padding: ${space(0.75)} ${space(1)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.textColor};
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const IssueTrackingSection = styled('div')`
  margin-top: ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const IssueTrackingLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const IssueTrackingContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const PeopleSection = styled('div')`
  margin-top: ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const PeopleLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const PeopleContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const PeopleRow = styled(Flex)`
  align-items: center;
  gap: ${space(1)};
`;

const RootCauseContent = styled('div')`
  margin-top: ${space(1)};
`;

const RootCauseDescription = styled('div')`
  margin-bottom: ${space(2)};
  line-height: 1.6;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.md};

  /* Style for any HTML content in the description */
  p {
    margin: ${space(1)} 0;
  }

  strong {
    font-weight: ${p => p.theme.fontWeight.bold};
  }

  code {
    background: ${p => p.theme.backgroundSecondary};
    padding: ${space(0.25)} ${space(0.5)};
    border-radius: ${p => p.theme.borderRadius};
    font-family: ${p => p.theme.text.familyMono};
    font-size: ${p => p.theme.fontSize.sm};
  }
`;

const SolutionWrapper = styled('div')`
  max-width: 768px;
`;

const SolutionCard = styled(Card)`
  width: 100%;
`;

const SolutionContent = styled('div')`
  /* Hide the internal "Code Changes" header from AutofixChanges component */
  > div > div > div:first-child {
    display: none;
  }

  /* Remove the border from the internal ChangesContainer */
  > div > div {
    border: none;
    box-shadow: none;
    padding: 0;
  }
`;

const DebuggerWrapper = styled('div')<{isExpanded: boolean}>`
  max-width: ${p => p.isExpanded ? 'none' : '768px'};
  width: 100%;
`;

const DebuggerCard = styled(Card)`
  width: 100%;
`;

const DebuggerContent = styled('div')`
  margin-top: ${space(1)};

  /* Add some spacing between header and content */
  > * + * {
    margin-top: ${space(2)};
  }
`;

const DebuggerHeaderContent = styled('button')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  margin: 0;
  background: none;
  border: none;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`;

const HeaderRight = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const DebuggerSubtitle = styled('span')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  color: ${p => p.theme.gray400};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

// Similar Issues Section Component
interface SimilarIssue {
  id: string;
  level: string;
  permalink: string;
  shortId: string;
  status: string;
  title: string;
}

interface SimilarIssuesSectionProps {
  group: Group;
  onSimilarIssuesCountChange: (count: number) => void;
}

function SimilarIssuesSection({group, onSimilarIssuesCountChange}: SimilarIssuesSectionProps) {
  const [similarIssues, setSimilarIssues] = useState<SimilarIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();
  const organization = useOrganization();

  useEffect(() => {
    fetchSimilarIssues();
  }, [group.id]);

  const fetchSimilarIssues = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.requestPromise(
        `/organizations/${organization.slug}/issues/${group.id}/similar-issues-embeddings/?k=10&threshold=0.01&useReranking=true`
      );

      // Response is an array of [serialized_group, scores] tuples
      const issues = response.map(([issue]: [any, any]) => ({
        id: issue.id,
        title: issue.title || issue.metadata?.title || 'Unknown Issue',
        shortId: issue.shortId,
        permalink: issue.permalink,
        status: issue.status,
        level: issue.level,
      }));

      setSimilarIssues(issues);
      onSimilarIssuesCountChange(issues.length);
    } catch (err) {
      console.error('Failed to fetch similar issues:', err);
      setError('Failed to load similar issues');
      onSimilarIssuesCountChange(0);
    } finally {
      setLoading(false);
    }
  };

  if (!similarIssues.length && !loading && !error) {
    return null;
  }

  return (
    <SimilarIssuesWrapper>
      <SimilarIssuesLabel>{t('Similar Issues:')}</SimilarIssuesLabel>
      <SimilarIssuesContent>
        {loading && <LoadingIndicator mini />}
        {error && <ErrorText>{error}</ErrorText>}
        {!loading && !error && similarIssues.length > 0 && (
          <SimilarIssuesPills>
            {similarIssues.map(issue => (
              <Tooltip key={issue.id} title={issue.title}>
                <SimilarIssuePill
                  to={issue.permalink}
                  level={issue.level}
                  status={issue.status}
                >
                  {issue.shortId}
                </SimilarIssuePill>
              </Tooltip>
            ))}
          </SimilarIssuesPills>
        )}
      </SimilarIssuesContent>
    </SimilarIssuesWrapper>
  );
}

const SimilarIssuesWrapper = styled('div')`
  margin-top: ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const SimilarIssuesLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const SimilarIssuesContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const SimilarIssuesPills = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
`;

const SimilarIssuePill = styled(Link)<{level: string; status: string}>`
  display: inline-flex;
  align-items: center;
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-decoration: none;
  transition: all 0.2s ease;

  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.textColor};
  border: 1px solid ${p => p.theme.border};

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    text-decoration: none;
    color: ${p => p.theme.textColor};
  }
`;

const ErrorText = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.error};
`;

const ActivityWrapper = styled('div')`
  max-width: 768px;
  width: 100%;
`;

const ActivityCard = styled(Card)`
  width: 100%;
`;

// Action Items Section Component
interface ActionItemsSectionProps {
  similarIssuesCount: number;
}

function ActionItemsSection({similarIssuesCount}: ActionItemsSectionProps) {
  // Action items based on conditions
  const actionItems = [];
  
  // Add merge action item if there are multiple similar issues
  if (similarIssuesCount > 1) {
    actionItems.push({id: 'merge', text: 'Merge Similar Issues'});
  }

  // Don't render if no action items
  if (actionItems.length === 0) {
    return null;
  }

  return (
    <ActionItemsWrapper>
      <ActionItemsLabel>{t('Action Items:')}</ActionItemsLabel>
      <ActionItemsContent>
        <ActionItemsPills>
          {actionItems.map(item => (
            <ActionItemPill key={item.id}>{item.text}</ActionItemPill>
          ))}
        </ActionItemsPills>
      </ActionItemsContent>
    </ActionItemsWrapper>
  );
}

const ActionItemsWrapper = styled('div')`
  margin-top: ${space(2)};
  padding-bottom: ${space(4)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ActionItemsLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const ActionItemsContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const ActionItemsPills = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
`;

const ActionItemPill = styled('div')`
  display: inline-flex;
  align-items: center;
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.bold};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.textColor};
  border: 1px solid ${p => p.theme.border};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;

const TokenInputContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin: ${space(2)} 0;
  align-items: flex-end;
`;

const TokenInput = styled('input')`
  flex: 1;
  padding: ${space(1)} ${space(1.5)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.sm};
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};

  &:focus {
    outline: none;
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 0 0 1px ${p => p.theme.purple300};
  }

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

const TokenActions = styled('div')`
  margin-top: ${space(1)};
  display: flex;
  justify-content: flex-start;
`;

const TokenStatus = styled('div')`
  margin-top: ${space(2)};
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundSecondary};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const TokenStatusGood = styled('div')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.successText};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const TokenStatusMissing = styled('div')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.warningText};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ProgressContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(2)};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundSecondary};
`;

const ProgressIndicator = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const ProgressText = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.md};
`;

const ProgressMessages = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding-left: ${space(2)};
  border-left: 2px solid ${p => p.theme.border};
`;

const ProgressMessage = styled('div')<{type: 'INFO' | 'WARNING' | 'ERROR' | 'NEED_MORE_INFORMATION'}>`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => {
    switch (p.type) {
      case 'ERROR':
        return p.theme.error;
      case 'WARNING':
        return p.theme.warningText;
      case 'NEED_MORE_INFORMATION':
        return p.theme.yellow300;
      default:
        return p.theme.subText;
    }
  }};
  line-height: 1.4;
  font-family: ${p => p.theme.text.family};
`;

const EmptyStateText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  text-align: center;
  padding: ${space(3)};
  font-style: italic;
`;

const InitialGuessContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding: ${space(2)};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundSecondary};
  border-left: 3px solid ${p => p.theme.purple300};
`;

const InitialGuessLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.purple300};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const InitialGuessContent = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.5;
`;

const ExitAIModeLink = styled('button')`
  background: none;
  border: none;
  color: ${p => p.theme.gray300};
  cursor: pointer;
  font-size: ${p => p.theme.fontSize.sm};
  padding: ${space(1)};
  text-decoration: underline;
  position: fixed;
  bottom: ${space(2)};
  right: ${space(2)};
  z-index: 1000;
  
  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

const ChartsMetricsSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  align-items: center;
  margin-top: ${space(3)};
`;

const ChartContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  width: 100%;
  max-width: 280px;
`;

const ChartTitle = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
  text-align: center;
`;
