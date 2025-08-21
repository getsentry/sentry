import {useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {Flex, Grid} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {
  IconCheckmark,
  IconClock,
  IconClose,
  IconFire,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useIncidentCase} from 'sentry/views/incidents/hooks/useIncidentCase';
import {animations} from 'sentry/views/incidents/styles';

interface TimelineEvent {
  description: string;
  id: string;
  timestamp: Date;
  title: string;
  type:
    | 'incident_declared'
    | 'status_update'
    | 'team_notified'
    | 'investigation_started'
    | 'resolution_identified'
    | 'incident_resolved';
  user?: string;
}

const mockTimelineEvents: TimelineEvent[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    type: 'incident_declared',
    title: t('Incident Declared'),
    description: t('High severity incident declared by engineering team'),
    user: 'Sarah Chen',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 25), // 25 minutes ago
    type: 'team_notified',
    title: t('On-Call Team Notified'),
    description: t('PagerDuty alert sent to on-call engineer'),
    user: 'System',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 1000 * 60 * 20), // 20 minutes ago
    type: 'investigation_started',
    title: t('Investigation Started'),
    description: t('Engineering team began investigating the root cause'),
    user: 'Mike Rodriguez',
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
    type: 'status_update',
    title: t('Status Update'),
    description: t('Identified database connection pool exhaustion as root cause'),
    user: 'Sarah Chen',
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    type: 'resolution_identified',
    title: t('Resolution Identified'),
    description: t('Implementing connection pool limits and monitoring'),
    user: 'Mike Rodriguez',
  },
];

export default function IncidentCaseDetails() {
  const organization = useOrganization();
  // @ts-expect-error This is valid but not worth fixing for hackweek.
  const params = useParams<{caseId: string}>();
  const caseId = params.caseId;
  const [activeTab, setActiveTab] = useState('overview');

  const {incidentCase, isLoading, error} = useIncidentCase({
    organizationSlug: organization.slug,
    caseId,
  });

  if (isLoading) {
    return (
      <Layout.Page>
        <Layout.Body>
          <Layout.Main>
            <LoadingContainer>
              <div>{t('Loading incident case...')}</div>
            </LoadingContainer>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  if (error || !incidentCase) {
    return (
      <Layout.Page>
        <Layout.Body>
          <Layout.Main>
            <ErrorContainer>
              <div>{t('Failed to load incident case')}</div>
            </ErrorContainer>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 1:
        return '#10B981'; // green
      case 2:
        return '#F59E0B'; // yellow
      case 3:
        return '#F97316'; // orange
      case 4:
        return '#EF4444'; // red
      default:
        return '#6B7280'; // gray
    }
  };

  const getSeverityLabel = (severity: number) => {
    switch (severity) {
      case 1:
        return t('Low');
      case 2:
        return t('Medium');
      case 3:
        return t('High');
      case 4:
        return t('Critical');
      default:
        return t('Unknown');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <IconWarning size="sm" />;
      case 'in_progress':
        return <IconClock size="sm" />;
      case 'resolved':
        return <IconCheckmark size="sm" />;
      case 'closed':
        return <IconClose size="sm" />;
      default:
        return <IconWarning size="sm" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return '#EF4444'; // red
      case 'in_progress':
        return '#F59E0B'; // yellow
      case 'resolved':
        return '#10B981'; // green
      case 'closed':
        return '#6B7280'; // gray
      default:
        return '#6B7280'; // gray
    }
  };

  return (
    <Layout.Page>
      <SentryDocumentTitle title={`${incidentCase.title} - ${t('Incident Case')}`} />

      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex justify="between" align="center">
            <Layout.Title>
              <Flex align="center" gap="sm">
                <IconFire
                  size="lg"
                  style={{color: getSeverityColor(incidentCase.severity)}}
                />
                {incidentCase.title}
              </Flex>
            </Layout.Title>
            <Flex gap="sm" align="center">
              <SeverityBadge severity={incidentCase.severity}>
                {getSeverityLabel(incidentCase.severity)}
              </SeverityBadge>
              <StatusBadge status={incidentCase.status}>
                {getStatusIcon(incidentCase.status)}
                {incidentCase.status.replace('_', ' ')}
              </StatusBadge>
            </Flex>
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main>
          <motion.div {...animations.moveOver}>
            <Grid columns="1fr 300px" gap="lg">
              {/* Main Content */}
              <MainContent>
                {/* Case Overview */}
                <CaseSection>
                  <SectionTitle>{t('Case Overview')}</SectionTitle>
                  <Grid columns="1fr 1fr" gap="md">
                    <InfoCard>
                      <InfoLabel>{t('Description')}</InfoLabel>
                      <InfoValue>
                        {incidentCase.description || t('No description provided')}
                      </InfoValue>
                    </InfoCard>
                    <InfoCard>
                      <InfoLabel>{t('Case Lead')}</InfoLabel>
                      <InfoValue>
                        <Flex align="center" gap="sm">
                          <IconUser size="sm" />
                          {incidentCase.case_lead?.name || t('Unassigned')}
                        </Flex>
                      </InfoValue>
                    </InfoCard>
                    <InfoCard>
                      <InfoLabel>{t('Template')}</InfoLabel>
                      <InfoValue>{incidentCase.template.name}</InfoValue>
                    </InfoCard>
                    <InfoCard>
                      <InfoLabel>{t('Started')}</InfoLabel>
                      <InfoValue>{new Date().toLocaleDateString()}</InfoValue>
                    </InfoCard>
                  </Grid>
                </CaseSection>

                {/* Timeline */}
                <CaseSection>
                  <SectionTitle>{t('Timeline')}</SectionTitle>
                  <TimelineContainer>
                    {mockTimelineEvents.map((event, index) => (
                      <TimelineEvent
                        key={event.id}
                        event={event}
                        isLast={index === mockTimelineEvents.length - 1}
                      />
                    ))}
                  </TimelineContainer>
                </CaseSection>
              </MainContent>

              {/* Sidebar */}
              <Sidebar>
                <SidebarSection>
                  <SectionTitle>{t('Quick Actions')}</SectionTitle>
                  <Button priority="primary" size="sm" style={{width: '100%'}}>
                    {t('Update Status')}
                  </Button>
                  <Button size="sm" style={{width: '100%', marginTop: space(1)}}>
                    {t('Add Note')}
                  </Button>
                </SidebarSection>

                <SidebarSection>
                  <SectionTitle>{t('Record Links')}</SectionTitle>
                  <RecordLink
                    title={t('Communication Channel')}
                    description={t('View chat discussions and updates')}
                    provider={incidentCase.template.channel_provider}
                    onClick={() => setActiveTab('channel')}
                  />
                  <RecordLink
                    title={t('Task Management')}
                    description={t('Track action items and assignments')}
                    provider={incidentCase.template.task_provider}
                    onClick={() => setActiveTab('tasks')}
                  />
                  <RecordLink
                    title={t('Paging/Schedule')}
                    description={t('Manage on-call rotations and escalations')}
                    provider={incidentCase.template.schedule_provider}
                    onClick={() => setActiveTab('schedule')}
                  />
                  <RecordLink
                    title={t('Status Page')}
                    description={t('Update external status and communications')}
                    provider={incidentCase.template.status_page_provider}
                    onClick={() => setActiveTab('status')}
                  />
                  <RecordLink
                    title={t('Post-Mortem')}
                    description={t('Document lessons learned and improvements')}
                    provider={incidentCase.template.retro_provider}
                    onClick={() => setActiveTab('retro')}
                  />
                </SidebarSection>

                <SidebarSection>
                  <SectionTitle>{t('Template Details')}</SectionTitle>
                  <InfoRow>
                    <InfoLabel>{t('Case Handle')}</InfoLabel>
                    <InfoValue>
                      {incidentCase.template.case_handle || t('Not set')}
                    </InfoValue>
                  </InfoRow>
                  <InfoRow>
                    <InfoLabel>{t('Lead Title')}</InfoLabel>
                    <InfoValue>
                      {incidentCase.template.case_lead_title || t('Not set')}
                    </InfoValue>
                  </InfoRow>
                  <InfoRow>
                    <InfoLabel>{t('Severity Handle')}</InfoLabel>
                    <InfoValue>
                      {incidentCase.template.severity_handle || t('Not set')}
                    </InfoValue>
                  </InfoRow>
                  {incidentCase.template.update_frequency_minutes && (
                    <InfoRow>
                      <InfoLabel>{t('Update Frequency')}</InfoLabel>
                      <InfoValue>
                        {t('Every {{minutes}} minutes', {
                          minutes: incidentCase.template.update_frequency_minutes,
                        })}
                      </InfoValue>
                    </InfoRow>
                  )}
                </SidebarSection>
              </Sidebar>
            </Grid>
          </motion.div>
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

function TimelineEvent({event, isLast}: {event: TimelineEvent; isLast: boolean}) {
  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'incident_declared':
        return <IconFire size="sm" style={{color: '#EF4444'}} />;
      case 'status_update':
        return <IconWarning size="sm" style={{color: '#F59E0B'}} />;
      case 'team_notified':
        return <IconClock size="sm" style={{color: '#3B82F6'}} />;
      case 'investigation_started':
        return <IconUser size="sm" style={{color: '#8B5CF6'}} />;
      case 'resolution_identified':
        return <IconCheckmark size="sm" style={{color: '#10B981'}} />;
      case 'incident_resolved':
        return <IconCheckmark size="sm" style={{color: '#10B981'}} />;
      default:
        return <IconWarning size="sm" />;
    }
  };

  return (
    <TimelineEventContainer>
      <TimelineIcon>{getEventIcon(event.type)}</TimelineIcon>
      <TimelineContent>
        <TimelineEventTitle>{event.title}</TimelineEventTitle>
        <TimelineEventDescription>{event.description}</TimelineEventDescription>
        <TimelineEventMeta>
          <span>{event.user}</span>
          <span>{event.timestamp.toLocaleTimeString()}</span>
        </TimelineEventMeta>
      </TimelineContent>
      {!isLast && <TimelineLine />}
    </TimelineEventContainer>
  );
}

function RecordLink({
  title,
  description,
  provider,
  onClick,
}: {
  description: string;
  onClick: () => void;
  title: string;
  provider?: string;
}) {
  if (!provider) {
    return (
      <RecordLinkItem disabled>
        <RecordLinkTitle>{title}</RecordLinkTitle>
        <RecordLinkDescription>{description}</RecordLinkDescription>
        <RecordLinkStatus>{t('Not configured')}</RecordLinkStatus>
      </RecordLinkItem>
    );
  }

  return (
    <RecordLinkItem onClick={onClick}>
      <RecordLinkTitle>{title}</RecordLinkTitle>
      <RecordLinkDescription>{description}</RecordLinkDescription>
      <RecordLinkStatus>{provider}</RecordLinkStatus>
    </RecordLinkItem>
  );
}

// Styled Components
const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: ${p => p.theme.subText};
`;

const ErrorContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: ${p => p.theme.errorText};
`;

const MainContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const Sidebar = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const CaseSection = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)};
`;

const SidebarSection = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
`;

const SectionTitle = styled('h3')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0 0 ${space(2)} 0;
  color: ${p => p.theme.textColor};
`;

const InfoCard = styled('div')`
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const InfoLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.subText};
  margin-bottom: ${space(0.5)};
  text-transform: uppercase;
`;

const InfoValue = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.textColor};
`;

const InfoRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  &:last-child {
    border-bottom: none;
  }
`;

const SeverityBadge = styled('div')<{severity: number}>`
  display: inline-flex;
  align-items: center;
  padding: ${space(0.5)} ${space(1)};
  background: ${p => getSeverityColor(p.severity)}20;
  color: ${p => getSeverityColor(p.severity)};
  border: 1px solid ${p => getSeverityColor(p.severity)}40;
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const StatusBadge = styled('div')<{status: string}>`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
  background: ${p => getStatusColor(p.status)}20;
  color: ${p => getStatusColor(p.status)};
  border: 1px solid ${p => getStatusColor(p.status)}40;
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const TimelineContainer = styled('div')`
  position: relative;
`;

const TimelineEventContainer = styled('div')`
  position: relative;
  display: flex;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const TimelineIcon = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: ${p => p.theme.backgroundSecondary};
  border: 2px solid ${p => p.theme.border};
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 1;
`;

const TimelineContent = styled('div')`
  flex: 1;
  padding-bottom: ${space(2)};
`;

const TimelineEventTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.5)};
`;

const TimelineEventDescription = styled('div')`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(0.5)};
`;

const TimelineEventMeta = styled('div')`
  display: flex;
  gap: ${space(2)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const TimelineLine = styled('div')`
  position: absolute;
  left: 15px;
  top: 32px;
  bottom: 0;
  width: 2px;
  background: ${p => p.theme.border};
`;

const RecordLinkItem = styled('div')<{disabled?: boolean}>`
  padding: ${space(2)};
  background: ${p => (p.disabled ? p.theme.backgroundSecondary : p.theme.background)};
  border: 1px solid ${p => (p.disabled ? p.theme.border : p.theme.border)};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(1)};
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  opacity: ${p => (p.disabled ? 0.6 : 1)};
  transition: all 0.2s ease;

  &:hover {
    ${p =>
      !p.disabled &&
      `
      background: ${p.theme.backgroundSecondary};
      border-color: ${p.theme.border};
    `}
  }
`;

const RecordLinkTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.5)};
`;

const RecordLinkDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-bottom: ${space(0.5)};
`;

const RecordLinkStatus = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.subText};
`;

// Helper functions for colors (moved outside styled components)
function getSeverityColor(severity: number): string {
  switch (severity) {
    case 1:
      return '#10B981'; // green
    case 2:
      return '#F59E0B'; // yellow
    case 3:
      return '#F97316'; // orange
    case 4:
      return '#EF4444'; // red
    default:
      return '#6B7280'; // gray
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return '#EF4444'; // red
    case 'in_progress':
      return '#F59E0B'; // yellow
    case 'resolved':
      return '#10B981'; // green
    case 'closed':
      return '#6B7280'; // gray
    default:
      return '#6B7280'; // gray
  }
}
