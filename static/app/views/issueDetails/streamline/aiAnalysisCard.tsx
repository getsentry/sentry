import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';
import type {AutofixRootCauseData} from 'sentry/components/events/autofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface AIAnalysisCardProps {
  event: Event | null;
  group: Group;
  project: Project;
}

interface SeverityAnalysis {
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  title: string;
  timeline: {
    firstSeen: string;
    lastSeen: string;
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
  impact: {
    description: string;
  };
  volume: {
    trending: string;
    reach: string;
  };
  reasoning: string;
}

interface AutofixResponse {
  autofix: {
    run_id: string;
    status: 'COMPLETED' | 'PENDING' | 'FAILED';
    steps: Array<{
      key: string;
      title: string;
      status: 'COMPLETED' | 'PENDING' | 'FAILED';
      causes?: AutofixRootCauseData[];
    }>;
  };
}

interface AnalysisData {
  analysis: SeverityAnalysis;
  success: boolean;
  timestamp: string;
  error?: string;
}

export function AIAnalysisCard({group, event}: AIAnalysisCardProps) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [autofixData, setAutofixData] = useState<AutofixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const api = useApi();
  const organization = useOrganization();


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

      // Fetch both severity analysis and autofix data in parallel
      const [severityPromise, autofixPromise] = await Promise.allSettled([
        // Still use fetch for our external severity API
        fetch(`http://localhost:3001/api/severity-agent/${group.id}`, {
          method: 'GET',
          headers: {'Content-Type': 'application/json'},
        }),
        // Use Sentry's authenticated API for autofix data
        api.requestPromise(`/organizations/${organization.slug}/issues/${group.id}/autofix/`)
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
        if (!autofixResponseData?.autofix) {
          console.log('No existing autofix run found, starting autofix...');
          await startAutofix();
        } else {
          setAutofixData(autofixResponseData);
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


  if (loading) {
    return (
      <AIContainer>
        <LoadingIndicator />
        <LoadingText>
          {t('Running AI severity assessment...')}
        </LoadingText>
      </AIContainer>
    );
  }

  if (error && !analysisData) {
    return (
      <AIContainer>
        <ErrorCard>
          <CardHeader>
            <CardTitle>🤖 {t('AI Analysis')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorMessage>{t('Failed to load analysis: %s', error)}</ErrorMessage>
            <Button onClick={fetchAnalysis} size="sm">
              {t('Retry')}
            </Button>
          </CardContent>
        </ErrorCard>
      </AIContainer>
    );
  }

  if (!analysisData) {
    return (
      <AIContainer>
        <GetStartedCard>
          <CardHeader>
            <CardTitle>🤖 {t('AI Analysis')}</CardTitle>
          </CardHeader>
          <CardContent>
            <P>
              {t(
                'Get AI-powered severity assessment for this issue including impact analysis and priority recommendations.'
              )}
            </P>
            <Button onClick={fetchAnalysis} priority="primary">
              {t('Run AI Analysis')}
            </Button>
          </CardContent>
        </GetStartedCard>
      </AIContainer>
    );
  }

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return '#EF4444'; // red
      case 'high': return '#F97316'; // orange  
      case 'medium': return '#EAB308'; // yellow
      case 'low': return '#22C55E'; // green
      default: return '#6B7280'; // gray
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
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
  };

  // Get root cause data from autofix response
  const getRootCauseData = (): {causes: AutofixRootCauseData[], runId: string} | null => {
    if (!autofixData?.autofix?.steps || !autofixData.autofix.run_id) return null;
    
    const rootCauseStep = autofixData.autofix.steps.find(
      step => step.key === 'root_cause_analysis'
    );
    
    return rootCauseStep?.causes ? {
      causes: rootCauseStep.causes,
      runId: autofixData.autofix.run_id
    } : null;
  };

  const rootCauseData = getRootCauseData();

  return (
    <AIContainer>
      <SeverityCard>
        <CardHeader>
          <HeaderLeft>
            <CardTitle>🤖 {t('AI Severity Assessment')}</CardTitle>
            <SeverityBadge color={getSeverityBadgeColor(analysisData.analysis.severity)}>
              {analysisData.analysis.severity}
            </SeverityBadge>
          </HeaderLeft>
          <Timestamp>
            {new Date(analysisData.timestamp).toLocaleTimeString()}
          </Timestamp>
        </CardHeader>
        
        <CardContent>
          {analysisData.success ? (
            <>
              {/* Issue Title */}
              <IssueTitle>{analysisData.analysis.title}</IssueTitle>
              
              {/* Timeline */}
              <TimelineSection>
                <TimelineItem>
                  <TimelineLabel>{t('First seen:')}</TimelineLabel>
                  <TimelineValue>{formatTimeAgo(analysisData.analysis.timeline.firstSeen)}</TimelineValue>
                </TimelineItem>
                <TimelineItem>
                  <TimelineLabel>{t('Last seen:')}</TimelineLabel>
                  <TimelineValue>{formatTimeAgo(analysisData.analysis.timeline.lastSeen)}</TimelineValue>
                </TimelineItem>
              </TimelineSection>

              {/* Metrics */}
              <MetricsGrid>
                <MetricCard>
                  <MetricLabel>{t('Events')}</MetricLabel>
                  <MetricValue>
                    {analysisData.analysis.metrics.events.count.toLocaleString()}
                    <MetricSubtitle>over {analysisData.analysis.metrics.events.timeframe}</MetricSubtitle>
                  </MetricValue>
                </MetricCard>
                
                <MetricCard>
                  <MetricLabel>{t('Failure Rate')}</MetricLabel>
                  <MetricValue>{analysisData.analysis.metrics.failureRate.percentage}%</MetricValue>
                </MetricCard>
                
                <MetricCard>
                  <MetricLabel>{analysisData.analysis.metrics.usersAffected.label}</MetricLabel>
                  <MetricValue>{analysisData.analysis.metrics.usersAffected.count}</MetricValue>
                </MetricCard>
              </MetricsGrid>

              {/* Analysis Sections */}
              <AnalysisSection>
                <SectionTitle>{t('Impact Assessment')}</SectionTitle>
                <SectionContent>{analysisData.analysis.impact.description}</SectionContent>
              </AnalysisSection>

              <AnalysisSection>
                <SectionTitle>{t('Volume Analysis')}</SectionTitle>
                <VolumeContent>
                  <VolumeItem>
                    <strong>{t('Trending:')}</strong> {analysisData.analysis.volume.trending}
                  </VolumeItem>
                  <VolumeItem>
                    <strong>{t('Reach:')}</strong> {analysisData.analysis.volume.reach}
                  </VolumeItem>
                </VolumeContent>
              </AnalysisSection>

              <AnalysisSection>
                <SectionTitle>{t('AI Reasoning')}</SectionTitle>
                <SectionContent>{analysisData.analysis.reasoning}</SectionContent>
              </AnalysisSection>
            </>
          ) : (
            <ErrorMessage>
              {t('Severity assessment failed: %s', analysisData.error || 'Unknown error')}
            </ErrorMessage>
          )}
        </CardContent>
      </SeverityCard>

      {/* Root Cause Analysis Section */}
      {rootCauseData && (
        <RootCauseSection>
          <AutofixRootCause
            causes={rootCauseData.causes}
            groupId={group.id}
            runId={rootCauseData.runId}
            rootCauseSelection={null}
            event={event}
          />
        </RootCauseSection>
      )}
    </AIContainer>
  );
}

const AIContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  padding: ${space(2)} 0;
`;

const SeverityCard = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const AnalysisCard = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const GetStartedCard = styled(AnalysisCard)`
  border-color: ${p => p.theme.purple400};
  background: ${p => p.theme.purple100};
`;

const ErrorCard = styled(AnalysisCard)`
  border-color: ${p => p.theme.red400};
  background: ${p => p.theme.red100};
`;

const CardHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(2)} ${space(3)};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const CardTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Timestamp = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const CardContent = styled('div')`
  padding: ${space(3)};
`;

const LoadingText = styled('div')`
  margin-top: ${space(2)};
  text-align: center;
  color: ${p => p.theme.subText};
  font-style: italic;
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
  gap: ${space(1)};
`;

const SeverityBadge = styled('span')<{color: string}>`
  background: ${p => p.color};
  color: white;
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-transform: uppercase;
`;

const IssueTitle = styled('h4')`
  margin: 0 0 ${space(2)} 0;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
`;

const TimelineSection = styled('div')`
  display: flex;
  gap: ${space(3)};
  margin-bottom: ${space(3)};
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
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

const MetricsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const MetricCard = styled('div')`
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  text-align: center;
`;

const MetricLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-bottom: ${space(0.5)};
`;

const MetricValue = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
  display: flex;
  flex-direction: column;
`;

const MetricSubtitle = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
  margin-top: ${space(0.5)};
`;

const AnalysisSection = styled('div')`
  margin-bottom: ${space(3)};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled('h5')`
  margin: 0 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
`;

const SectionContent = styled('p')`
  margin: 0;
  line-height: 1.5;
  color: ${p => p.theme.textColor};
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

const RootCauseSection = styled('div')`
  margin-top: ${space(3)};
`;
