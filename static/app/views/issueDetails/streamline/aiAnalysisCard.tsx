import {useState, useEffect} from 'react';
import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import {Button} from 'sentry/components/core/button';
import {IconChevron, IconSeer} from 'sentry/icons';
import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';
import type {AutofixRootCauseData} from 'sentry/components/events/autofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

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
  const [showReasoning, setShowReasoning] = useState(false);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isAIMode = searchParams.get('aiMode') === 'true';
  
  const api = useApi();
  const organization = useOrganization();

  // Auto-fetch analysis when component mounts in AI mode
  useEffect(() => {
    if (isAIMode && !analysisData && !loading) {
      fetchAnalysis();
    }
  }, [isAIMode]); // Only depend on isAIMode to avoid infinite loops

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
      </AIContainer>
    );
  }

  if (!analysisData) {
    return (
      <AIContainer>
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

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return {
        background: 'linear-gradient(135deg, #FA4E61 0%, #E91E3A 100%)',
        text: '#FFFFFF'
      };
      case 'high': return {
        background: 'linear-gradient(135deg, #FF8C73 0%, #FF6B50 100%)',
        text: '#FFFFFF'
      };
      case 'medium': return {
        background: 'linear-gradient(135deg, #FFC854 0%, #FFAE33 100%)',
        text: '#3E2723'
      };
      case 'low': return {
        background: 'linear-gradient(135deg, #8FD4A8 0%, #6FBF8C 100%)',
        text: '#FFFFFF'
      };
      default: return {
        background: '#E9EBEF',
        text: '#3E3446'
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
    } if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } 
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    
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
            <CardTitle>
              <IconSeer size="md" />
              {t('Severity Assessment')}
            </CardTitle>
            <SeverityPill colors={getSeverityColor(analysisData.analysis.severity)}>
              {analysisData.analysis.severity}
            </SeverityPill>
          </HeaderLeft>
        </CardHeader>
        
        <CardContent>
          {analysisData.success ? (
            <React.Fragment>
              {/* Issue Title */}
              <IssueTitle>{analysisData.analysis.title}</IssueTitle>
              
              {/* Timeline and Metrics Row */}
              <TimelineMetricsRow>
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
                
                <MetricsSection>
                  <MetricItem>
                    <MetricLabel>{t('Events')}</MetricLabel>
                    <MetricValue>
                      {analysisData.analysis.metrics.events.count.toLocaleString()}
                      <MetricSubtitle>over {analysisData.analysis.metrics.events.timeframe}</MetricSubtitle>
                    </MetricValue>
                  </MetricItem>
                  
                  <MetricItem>
                    <MetricLabel>{t('Failure Rate')}</MetricLabel>
                    <MetricValue>{analysisData.analysis.metrics.failureRate.percentage}%</MetricValue>
                  </MetricItem>
                  
                  <MetricItem>
                    <MetricLabel>{analysisData.analysis.metrics.usersAffected.label}</MetricLabel>
                    <MetricValue>{analysisData.analysis.metrics.usersAffected.count}</MetricValue>
                  </MetricItem>
                </MetricsSection>
              </TimelineMetricsRow>

              {/* Analysis Sections */}
              <AnalysisSection>
                <SectionTitle>{t('Impact Assessment')}</SectionTitle>
                <ImpactContent>
                  {analysisData.analysis.impact.description.split('•').filter(Boolean).map((point, index) => (
                    <ImpactPoint key={index}>• {point.trim()}</ImpactPoint>
                  ))}
                </ImpactContent>
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
                <CollapsibleSectionHeader onClick={() => setShowReasoning(!showReasoning)}>
                  <ChevronIcon direction={showReasoning ? 'down' : 'right'}>
                    <IconChevron />
                  </ChevronIcon>
                  <SectionTitle>{t('Reasoning')}</SectionTitle>
                </CollapsibleSectionHeader>
                {showReasoning && (
                  <ReasoningContent>{analysisData.analysis.reasoning}</ReasoningContent>
                )}
              </AnalysisSection>
            </React.Fragment>
          ) : (
            <ErrorMessage>
              {t('Severity assessment failed: %s', analysisData.error || 'Unknown error')}
            </ErrorMessage>
          )}
        </CardContent>
      </SeverityCard>

      {/* Root Cause Analysis Section */}
      {rootCauseData && (
        <RootCauseWrapper>
          <RootCauseCard>
            <AutofixRootCause
              causes={rootCauseData.causes}
              groupId={group.id}
              runId={rootCauseData.runId}
              rootCauseSelection={null}
              event={event}
            />
          </RootCauseCard>
        </RootCauseWrapper>
      )}
    </AIContainer>
  );
}

const AIContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(3)};
  padding: ${space(2)} 0;
  align-items: stretch;
  
  @media (max-width: 1600px) {
    flex-direction: column;
  }
`;

const SeverityCard = styled(Card)`
  max-width: 768px;
  flex: 1 1 auto;
  min-height: 500px;
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
  gap: ${space(1.5)};
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

const IssueTitle = styled('h4')`
  margin: 0 0 ${space(2)} 0;
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  line-height: 1.3;
`;

const TimelineMetricsRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(3)};
  margin-bottom: ${space(2)};
  padding: ${space(1.5)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
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
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
`;

const RootCauseCard = styled(Card)`
  width: 100%;
  min-height: 500px;
  display: flex;
  flex-direction: column;
  
  /* Make the AutofixRootCause component flex */
  > div {
    flex: 1;
    display: flex;
    flex-direction: column;
    
    /* Make the content area flex */
    > div {
      flex: 1;
      display: flex;
      flex-direction: column;
      
      /* Push the last child (button container) to bottom */
      > *:last-child {
        margin-top: auto;
        padding-top: ${space(2)};
      }
    }
  }
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
  transform: ${p => p.direction === 'down' ? 'rotate(0)' : 'rotate(-90deg)'};
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
