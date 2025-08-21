import {useState} from 'react';
import styled from '@emotion/styled';

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

function getSeverityLabel(severity: number) {
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
}

function getStatusIcon(status: string) {
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
}

export default function IncidentCaseDetails() {
  const organization = useOrganization();
  // @ts-expect-error This is valid but not worth fixing for hackweek.
  const {caseId} = useParams<{caseId: string}>();
  const [_activeTab, setActiveTab] = useState('overview');

  const {incidentCase, isLoading, error} = useIncidentCase({
    organizationSlug: organization.slug,
    caseId,
  });

  if (isLoading) {
    return (
      <Layout.Page>
        <Layout.Body>
          <Layout.Main>
            <div style={{textAlign: 'center', padding: space(4)}}>
              {t('Loading incident case...')}
            </div>
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
            <div style={{textAlign: 'center', padding: space(4), color: 'red'}}>
              {t('Failed to load incident case')}
            </div>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  return (
    <Layout.Page>
      <SentryDocumentTitle title={`${incidentCase.title} - ${t('Incident Case')}`} />

      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex justify="between" align="center">
            <Layout.Title>
              <Flex align="center" gap="sm">
                <IconFire size="lg" />
                {incidentCase.title}
              </Flex>
            </Layout.Title>
            <Flex gap="sm" align="center">
              <Badge>{getSeverityLabel(incidentCase.severity)}</Badge>
              <Badge>
                {getStatusIcon(incidentCase.status)}
                {incidentCase.status.replace('_', ' ')}
              </Badge>
            </Flex>
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main>
          <Grid columns="1fr 300px" gap="lg">
            <MainContent>
              <Section>
                <h3>{t('Case Overview')}</h3>
                <Grid columns="1fr 1fr" gap="md">
                  <InfoCard>
                    <Label>{t('Description')}</Label>
                    <Value>
                      {incidentCase.description || t('No description provided')}
                    </Value>
                  </InfoCard>
                  <InfoCard>
                    <Label>{t('Case Lead')}</Label>
                    <Value>
                      <Flex align="center" gap="sm">
                        <IconUser size="sm" />
                        {incidentCase.case_lead?.name || t('Unassigned')}
                      </Flex>
                    </Value>
                  </InfoCard>
                  <InfoCard>
                    <Label>{t('Template')}</Label>
                    <Value>{incidentCase.template.name}</Value>
                  </InfoCard>
                  <InfoCard>
                    <Label>{t('Started')}</Label>
                    <Value>{new Date().toLocaleDateString()}</Value>
                  </InfoCard>
                </Grid>
              </Section>

              <Section>
                <h3>{t('Timeline')}</h3>
                <Timeline>
                  <TimelineItem>
                    <IconFire size="sm" />
                    <div>
                      <div>
                        <strong>{t('Incident Declared')}</strong>
                      </div>
                      <div>
                        {t('High severity incident declared by engineering team')}
                      </div>
                      <small>30 minutes ago</small>
                    </div>
                  </TimelineItem>
                  <TimelineItem>
                    <IconClock size="sm" />
                    <div>
                      <div>
                        <strong>{t('Team Notified')}</strong>
                      </div>
                      <div>{t('PagerDuty alert sent to on-call engineer')}</div>
                      <small>25 minutes ago</small>
                    </div>
                  </TimelineItem>
                </Timeline>
              </Section>
            </MainContent>

            <Sidebar>
              <Section>
                <h3>{t('Quick Actions')}</h3>
                <Button priority="primary" size="sm" style={{width: '100%'}}>
                  {t('Update Status')}
                </Button>
                <Button size="sm" style={{width: '100%', marginTop: space(1)}}>
                  {t('Add Note')}
                </Button>
              </Section>

              <Section>
                <h3>{t('Record Links')}</h3>
                <RecordLink
                  title={t('Communication Channel')}
                  provider={incidentCase.template.channel_provider}
                  onClick={() => setActiveTab('channel')}
                />
                <RecordLink
                  title={t('Task Management')}
                  provider={incidentCase.template.task_provider}
                  onClick={() => setActiveTab('tasks')}
                />
                <RecordLink
                  title={t('Paging/Schedule')}
                  provider={incidentCase.template.schedule_provider}
                  onClick={() => setActiveTab('schedule')}
                />
                <RecordLink
                  title={t('Status Page')}
                  provider={incidentCase.template.status_page_provider}
                  onClick={() => setActiveTab('status')}
                />
                <RecordLink
                  title={t('Post-Mortem')}
                  provider={incidentCase.template.retro_provider}
                  onClick={() => setActiveTab('retro')}
                />
              </Section>
            </Sidebar>
          </Grid>
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

function RecordLink({
  title,
  provider,
  onClick,
}: {
  onClick: () => void;
  title: string;
  provider?: string;
}) {
  if (!provider) {
    return (
      <RecordLinkItem disabled>
        <div>
          <strong>{title}</strong>
        </div>
        <small>{t('Not configured')}</small>
      </RecordLinkItem>
    );
  }

  return (
    <RecordLinkItem onClick={onClick}>
      <div>
        <strong>{title}</strong>
      </div>
      <small>{provider}</small>
    </RecordLinkItem>
  );
}

// Styled Components
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

const Section = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)};
`;

const InfoCard = styled('div')`
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const Label = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.subText};
  margin-bottom: ${space(0.5)};
  text-transform: uppercase;
`;

const Value = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.textColor};
`;

const Badge = styled('div')`
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Timeline = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const TimelineItem = styled('div')`
  display: flex;
  gap: ${space(2)};
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const RecordLinkItem = styled('div')<{disabled?: boolean}>`
  padding: ${space(2)};
  background: ${p => (p.disabled ? p.theme.backgroundSecondary : p.theme.background)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(1)};
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  opacity: ${p => (p.disabled ? 0.6 : 1)};

  &:hover {
    ${p => !p.disabled && `background: ${p.theme.backgroundSecondary};`}
  }
`;
