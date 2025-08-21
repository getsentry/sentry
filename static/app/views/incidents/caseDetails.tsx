import {Fragment} from 'react';
import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {DateTime} from 'sentry/components/dateTime';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Timeline} from 'sentry/components/timeline';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {
  CaseSeverityLabel,
  CaseStatusLabel,
} from 'sentry/views/incidents/components/caseLabels';
import {LinkCard} from 'sentry/views/incidents/components/linkCard';
import {useIncidentCase} from 'sentry/views/incidents/hooks/useIncidentCase';
import {getIncidentLabel} from 'sentry/views/incidents/util';
import {CONVERSATION_DATA, MOCK_TIMELINE} from 'sentry/views/incidents/wizard/hack';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export default function IncidentCaseDetails() {
  const organization = useOrganization();
  // @ts-expect-error This is valid but not worth fixing for hackweek.
  const {caseId} = useParams<{caseId: string}>();
  const user = useUser();

  const {incidentCase, isLoading, error} = useIncidentCase({
    organizationSlug: organization.slug,
    caseId,
  });
  const affectedComponents = incidentCase?.affected_components?.length
    ? incidentCase.affected_components
    : [];

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error || !incidentCase) {
    return "Couldn't load incident case";
  }

  return (
    <Layout.Page>
      <SentryDocumentTitle title={`${incidentCase.title} - ${t('Incident Case')}`} />
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex justify="between" align="center">
            <Layout.Title>
              <Heading as="h1">
                {getIncidentLabel(incidentCase)}: {incidentCase.title}
              </Heading>
            </Layout.Title>
            <Flex gap="sm" align="center">
              <CaseStatusLabel incidentCase={incidentCase} textSize="md" />
              <CaseSeverityLabel incidentCase={incidentCase} textSize="md" />
            </Flex>
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body style={{gridTemplateColumns: '1fr 265px'}}>
        <Layout.Main>
          <Flex direction="column" gap="2xl">
            <Flex direction="column" gap="2xl">
              <Flex direction="column" gap="sm">
                <Text bold>{t('Description')}</Text>
                <Text density="comfortable">
                  {incidentCase.description || t('No description provided')}
                </Text>
              </Flex>
              <Flex gap="2xl" justify="start">
                <Flex direction="column" gap="sm">
                  <Text bold>{t('Affected Components')}</Text>
                  {affectedComponents.map(component => (
                    <Text key={component.id} title={component.description}>
                      {component.name}
                    </Text>
                  ))}
                  {affectedComponents.length === 0 && <Text>--</Text>}
                </Flex>
                <Flex direction="column" gap="sm">
                  <Text bold>{t('Case Lead')}</Text>
                  <Flex align="center" gap="sm">
                    <UserAvatar user={user} />
                    <Text>{incidentCase.case_lead?.name || t('Unassigned')}</Text>
                  </Flex>
                </Flex>

                <Flex direction="column" gap="sm">
                  <Text bold>{t('Started At')}</Text>
                  <Text>
                    {incidentCase.started_at
                      ? new Date(incidentCase.started_at).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </Text>
                </Flex>
                <Flex direction="column" gap="sm">
                  <Text bold>{t('Resolved At')}</Text>
                  <Text>
                    {incidentCase.resolved_at
                      ? new Date(incidentCase.resolved_at).toLocaleDateString()
                      : '--'}
                  </Text>
                </Flex>
              </Flex>
              <Flex gap="2xl" />
            </Flex>
          </Flex>
          <SectionContainer>
            <InterimSection type={SectionKey.INCIDENT_TIMELINE} title={t('Timeline')}>
              <Timeline.Container>
                {MOCK_TIMELINE.map(item => (
                  <Timeline.Item
                    icon={item.icon}
                    timestamp={<DateTime date={item.time} />}
                    key={item.title}
                    colorConfig={item.colorConfig}
                    title={item.title}
                  >
                    <Timeline.Text>{item.text}</Timeline.Text>
                  </Timeline.Item>
                ))}
              </Timeline.Container>
            </InterimSection>
            <InterimSection
              type={SectionKey.INCIDENT_TRANSCRIPT}
              title={
                <Flex align="center" gap="sm">
                  <PluginIcon pluginId="slack" size={24} />
                  <Text size="lg">{t('Transcript')}</Text>
                </Flex>
              }
            >
              <Grid columns="auto auto auto" gap="md">
                {CONVERSATION_DATA.map((item, index) => (
                  <Fragment key={index}>
                    <Text bold>{item.name}</Text>
                    <DateTime format="HH:mm" date={item.timestamp} />
                    <Text>{item.message}</Text>
                  </Fragment>
                ))}
              </Grid>
            </InterimSection>
          </SectionContainer>
        </Layout.Main>
        <Layout.Side style={{position: 'relative'}}>
          <Flex direction="column" gap="2xl" style={{position: 'sticky', top: 12}}>
            <Flex direction="column" gap="md">
              <Heading as="h3">{t('Quick Actions')}</Heading>
              <ButtonBar>
                <Button priority="primary">{t('Update Status')}</Button>
              </ButtonBar>
              <ButtonBar>
                <Button
                  title={t(
                    "Tasks represent work needed to mitigate/resolve the incident as it's happening."
                  )}
                  size="sm"
                  icon={<IconAdd />}
                >
                  {t('New Task')}
                </Button>
                <Button
                  title={t(
                    'Follow-ups are to track the work that needs to be done after the incident is resolved.'
                  )}
                  size="sm"
                  icon={<IconAdd />}
                >
                  {t('New Follow-up')}
                </Button>
              </ButtonBar>
            </Flex>

            <Flex direction="column" gap="md">
              <Heading as="h3">{t('Tools')}</Heading>
              <LinkCard to={`slack://`}>
                <Flex align="center" gap="sm">
                  <PluginIcon
                    pluginId={incidentCase.template.channel_provider as any}
                    size={24}
                  />
                  <Text bold>
                    {t('Jump to #%s', getIncidentLabel(incidentCase).toLowerCase())}
                  </Text>
                </Flex>
              </LinkCard>
              <LinkCard to={`slack://`}>
                <Flex align="center" gap="sm">
                  <PluginIcon
                    pluginId={incidentCase.template.task_provider as any}
                    size={24}
                  />
                  <Text bold>
                    {t(
                      'See Tasks & Action Items',
                      getIncidentLabel(incidentCase).toLowerCase()
                    )}
                  </Text>
                </Flex>
              </LinkCard>
              <LinkCard to={`slack://`}>
                <Flex align="center" gap="sm">
                  <PluginIcon
                    pluginId={incidentCase.template.schedule_provider as any}
                    size={24}
                  />
                  <Text bold>
                    {t('On-call Schedule', getIncidentLabel(incidentCase).toLowerCase())}
                  </Text>
                </Flex>
              </LinkCard>
              <LinkCard to={`slack://`}>
                <Flex align="center" gap="sm">
                  <PluginIcon
                    pluginId={incidentCase.template.status_page_provider as any}
                    size={24}
                  />
                  <Text bold>{t('View Statuspage')}</Text>
                </Flex>
              </LinkCard>
              <LinkCard to={`slack://`}>
                <Flex align="center" gap="sm">
                  <PluginIcon
                    pluginId={incidentCase.template.retro_provider as any}
                    size={24}
                  />
                  <Text bold>{t('See Retro Doc')}</Text>
                </Flex>
              </LinkCard>
            </Flex>
          </Flex>
        </Layout.Side>
      </Layout.Body>
    </Layout.Page>
  );
}

const SectionContainer = styled('div')`
  padding: ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
