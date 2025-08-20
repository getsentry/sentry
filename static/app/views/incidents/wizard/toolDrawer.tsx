import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import {Button} from 'sentry/components/core/button/';
import {Flex} from 'sentry/components/core/layout';
import {Select} from 'sentry/components/core/select';
import {Heading, Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {INTEGRATION_CRIMES} from 'sentry/views/incidents/wizard/hack';

interface ToolDrawerProps {
  integration: OrganizationIntegration;
  onSubmit: (config: any) => void;
}

export function ToolDrawer({integration, onSubmit}: ToolDrawerProps) {
  return (
    <Fragment>
      <TopRightBackgroundImage src={HighlightTopRightPattern} />
      <Flex direction="column" gap="sm" padding="xl lg lg lg">
        <IntegrationContent integration={integration} onSubmit={onSubmit} />
      </Flex>
    </Fragment>
  );
}

function IntegrationContent({integration, onSubmit}: ToolDrawerProps) {
  const content = useMemo(() => {
    switch (integration.provider.key) {
      case 'pagerduty':
        return <PagerDutyContent integration={integration} onSubmit={onSubmit} />;
      case 'jira':
        return <JiraContent integration={integration} onSubmit={onSubmit} />;
      case 'slack':
        return <SlackContent integration={integration} onSubmit={onSubmit} />;
      case 'statuspage':
        return <StatusPageContent integration={integration} onSubmit={onSubmit} />;
      case 'notion':
        return <NotionContent integration={integration} onSubmit={onSubmit} />;
      default:
        return null;
    }
  }, [integration, onSubmit]);

  return (
    <Flex direction="column" gap="2xl" padding="3xl 0 0 0">
      <PluginIcon pluginId={integration.provider.key} size={60} />
      {content}
    </Flex>
  );
}

function PagerDutyContent({integration, onSubmit}: ToolDrawerProps) {
  const services = integration.configData?.service_table;
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);

  return (
    <Fragment>
      <Flex direction="column" gap="lg">
        <Heading as="h3" size="lg">
          {t('Connect a PagerDuty schedule')}
        </Heading>
        <Text variant="muted" size="lg">
          {t(
            'Bring over your existing PagerDuty schedule to automatically create incidents and notify the right people when issues arise.'
          )}
        </Text>
      </Flex>
      <Flex direction="column" gap="lg">
        <Text bold>{t('Select a PagerDuty service')}</Text>
        <Select
          options={services?.map(({service, integration_key}) => ({
            label: service,
            value: integration_key,
          }))}
          value={selectedSchedule}
          onChange={setSelectedSchedule}
        />
        <SubmitButton
          priority="primary"
          disabled={!selectedSchedule}
          onClick={() =>
            onSubmit({
              integrationKey: integration.provider.key,
              service: selectedSchedule,
              integrationId: integration.id,
            })
          }
        >
          {t('Connect')}
        </SubmitButton>
      </Flex>
    </Fragment>
  );
}

function JiraContent({integration, onSubmit}: ToolDrawerProps) {
  const availableProjects = INTEGRATION_CRIMES.jira;
  const [selectedProject, setSelectedProject] = useState<any | null>();

  return (
    <Fragment>
      <Flex direction="column" gap="lg">
        <Heading as="h3" size="lg">
          {t('Assign a Jira Project for incidents')}
        </Heading>
        <Text variant="muted" size="lg">
          {t(
            'A ticket will be created for each incident, and the assignee will be the incident lead. Tasks and follow-ups will be added as sub-tasks.'
          )}
        </Text>
      </Flex>
      <Flex direction="column" gap="lg">
        <Text bold>{t('Select a Jira project')}</Text>
        <Select
          options={availableProjects.map(({id, code, name}) => ({
            label: `${code} - ${name}`,
            value: id,
          }))}
          value={selectedProject?.id}
          onChange={({value}: {value: string}) => {
            setSelectedProject(availableProjects.find(p => p.id === value));
          }}
        />
        <SubmitButton
          priority="primary"
          disabled={!selectedProject}
          onClick={() =>
            onSubmit({
              integrationKey: integration.provider.key,
              project: selectedProject,
              integrationId: integration.id,
            })
          }
        >
          {t('Connect')}
        </SubmitButton>
      </Flex>
    </Fragment>
  );
}

function SlackContent({integration, onSubmit}: ToolDrawerProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<any | null>(integration);
  return (
    <Fragment>
      <Flex direction="column" gap="lg">
        <Heading as="h3" size="lg">
          {t('Keep your discussions in one place')}
        </Heading>
        <Text variant="muted">
          {t(
            "We'll create a dedicated Slack channel for each incident, all you have to do is tell us the workspace."
          )}
        </Text>
      </Flex>
      <Flex direction="column" gap="lg">
        <Text bold>{t('Select a Slack workspace')}</Text>
        <Select
          options={[
            {
              label: integration.name,
              value: integration.id,
              leadingItems: <InlineIcon src={integration.icon!} />,
            },
          ]}
          value={selectedWorkspace?.id}
          // HACK: We only load one for now, so selection doesn't really work.
          onChange={(_option: {value: string}) => setSelectedWorkspace(selectedWorkspace)}
        />
        <SubmitButton
          priority="primary"
          disabled={!integration.id}
          onClick={() =>
            onSubmit({
              integrationKey: integration.provider.key,
              integrationId: integration.id,
            })
          }
        >
          {t('Connect')}
        </SubmitButton>
      </Flex>
    </Fragment>
  );
}

function StatusPageContent({integration, onSubmit}: ToolDrawerProps) {
  const availableStatusPages = INTEGRATION_CRIMES.statuspage;
  const [selectedStatusPage, setSelectedStatusPage] = useState<any | null>(
    availableStatusPages[0] ?? null
  );

  return (
    <Fragment>
      <Flex direction="column" gap="lg">
        <Heading as="h3" size="lg">
          {t('Connect StatusPage for public updates')}
        </Heading>
        <Text variant="muted">
          {t(
            'Automatically update your status page when incidents occur and keep your users informed about service status.'
          )}
        </Text>
      </Flex>
      <Flex direction="column" gap="lg">
        <Text bold>{t('Select a status page')}</Text>
        <Select
          options={availableStatusPages.map(({id, headline, url, favicon_logo}) => ({
            label: `${headline} (${url})`,
            value: id,
            leadingItems: <InlineIcon src={favicon_logo?.url} />,
          }))}
          value={selectedStatusPage?.id}
          onChange={({value}: {value: string}) =>
            setSelectedStatusPage(availableStatusPages.find(p => p.id === value) ?? null)
          }
        />
        <SubmitButton
          priority="primary"
          disabled={!selectedStatusPage}
          onClick={() =>
            onSubmit({
              integrationKey: integration.provider.key,
              statusPage: selectedStatusPage,
              integrationId: integration.id,
            })
          }
        >
          {t('Connect')}
        </SubmitButton>
      </Flex>
    </Fragment>
  );
}

function NotionContent({integration, onSubmit}: ToolDrawerProps) {
  const availableDatabases = INTEGRATION_CRIMES.notion;
  const [selectedDatabase, setSelectedDatabase] = useState<any | null>(null);

  return (
    <Fragment>
      <Flex direction="column" gap="lg">
        <Heading as="h3" size="lg">
          {t('Set up Notion for incident documentation')}
        </Heading>
        <Text variant="muted">
          {t(
            'Automatically create Notion pages for retros and maintain a knowledge base of learnings and procedures.'
          )}
        </Text>
      </Flex>
      <Flex direction="column" gap="lg">
        <Text bold>{t('Select a Notion database')}</Text>
        <Select
          options={availableDatabases.map(({id, title, icon}) => ({
            label: title.plain_text,
            value: id,
            leadingItems: <InlineIcon src={icon.external.url} />,
          }))}
          value={selectedDatabase?.id}
          onChange={({value}: {value: string}) =>
            setSelectedDatabase(availableDatabases.find(p => p.id === value) ?? null)
          }
        />
        <SubmitButton
          priority="primary"
          disabled={!selectedDatabase}
          onClick={() =>
            onSubmit({
              integrationKey: integration.provider.key,
              database: selectedDatabase,
              integrationId: integration.id,
            })
          }
        >
          {t('Connect')}
        </SubmitButton>
      </Flex>
    </Fragment>
  );
}

const TopRightBackgroundImage = styled('img')`
  position: absolute;
  top: 0;
  right: 0;
  width: 60%;
  user-select: none;
`;

const SubmitButton = styled(Button)`
  align-self: flex-end;
`;

const InlineIcon = styled('img')`
  width: 24px;
  height: 24px;
`;
