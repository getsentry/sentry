import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Badge} from 'sentry/components/core/badge';
import {Button} from 'sentry/components/core/button/';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCalendar, IconChat, IconDocs, IconList, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Integration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface ToolStepItem {
  heading: string;
  icon: React.ComponentType<any>;
  subtext: string;
  tools: Array<{
    icon: React.ReactNode;
    key: string;
    label: string;
  }>;
}

const checklistItems: ToolStepItem[] = [
  {
    icon: IconCalendar,
    heading: t('Configure a rotation schedule'),
    subtext: t('Share the responsibility across your team.'),
    tools: [
      {
        icon: <PluginIcon pluginId="sentry" />,
        label: t('Sentry'),
        key: 'sentry',
      },
      {
        icon: <PluginIcon pluginId="pagerduty" />,
        label: t('PagerDuty'),
        key: 'pagerduty',
      },
    ],
  },
  {
    icon: IconList,
    heading: t('Connect a task keeper'),
    subtext: t('Keep track of action items, during and after the incident.'),
    tools: [
      {
        icon: <PluginIcon pluginId="linear" />,
        label: t('Linear'),
        key: 'linear',
      },
      {
        icon: <PluginIcon pluginId="jira" />,
        label: t('Jira'),
        key: 'jira',
      },
    ],
  },
  {
    icon: IconChat,
    heading: t('Scope out your discussions'),
    subtext: t('Reserve a space for focused discussions.'),
    tools: [
      {
        icon: <PluginIcon pluginId="slack" />,
        label: t('Slack'),
        key: 'slack',
      },
      {
        icon: <PluginIcon pluginId="msteams" />,
        label: t('MS Teams'),
        key: 'msteams',
      },
      {
        icon: <PluginIcon pluginId="discord" />,
        label: t('Discord'),
        key: 'discord',
      },
    ],
  },
  {
    icon: IconMegaphone,
    heading: t('Communicate to your users'),
    subtext: t('Share the status of your incidents publicly.'),
    tools: [
      {
        icon: <PluginIcon pluginId="sentry" />,
        label: t('Sentry'),
        key: 'sentry',
      },
      {
        icon: <PluginIcon pluginId="statuspage" />,
        label: t('Statuspage'),
        key: 'statuspage',
      },
    ],
  },
  {
    icon: IconDocs,
    heading: t('Take the learnings'),
    subtext: t('An ounce of prevention is worth a pound of cure.'),
    tools: [
      {
        icon: <PluginIcon pluginId="confluence" />,
        label: t('Confluence'),
        key: 'confluence',
      },
      {
        icon: <PluginIcon pluginId="notion" />,
        label: t('Notion'),
        key: 'notion',
      },
      {
        icon: <PluginIcon pluginId="google-docs" />,
        label: t('Google Docs'),
        key: 'google-docs',
      },
    ],
  },
];

export function ToolStep() {
  const organization = useOrganization();
  const {data: integrations} = useApiQuery<Integration[]>(
    [`/organizations/${organization.slug}/integrations/`],
    {staleTime: 30000}
  );

  const integrationsByProvider = useMemo(() => {
    return integrations?.reduce(
      (acc, integration) => {
        acc[integration.provider.key] = integration;
        return acc;
      },
      {} as Record<string, Integration>
    );
  }, [integrations]);

  return (
    <ChecklistContainer>
      {checklistItems.map((item, index) => (
        <ChecklistItem key={index} isLast={index === checklistItems.length - 1}>
          <ChecklistCircle completed={false}>
            <item.icon size="md" />
          </ChecklistCircle>
          <Flex direction="column" gap="sm">
            <Heading as="h4" size="lg">
              {item.heading}
            </Heading>
            <Text variant="muted">{item.subtext}</Text>
            <Flex gap="md" align="start">
              {item.tools.map(tool => (
                <Button
                  key={tool.label}
                  size="sm"
                  icon={tool.icon}
                  disabled={tool.key === 'sentry'}
                >
                  {tool.label}
                  {tool.key === 'sentry' && (
                    <Badge type="experimental" style={{marginLeft: '8px'}}>
                      {t('Coming Soon')}
                    </Badge>
                  )}
                  {integrationsByProvider?.[tool.key] && (
                    <Tooltip title={t('Installation available!')}>
                      <ToolConnected />
                    </Tooltip>
                  )}
                </Button>
              ))}
            </Flex>
          </Flex>
        </ChecklistItem>
      ))}
    </ChecklistContainer>
  );
}

const ChecklistContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['3xl']};
`;

const ChecklistItem = styled('div')<{isLast: boolean}>`
  position: relative;
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  gap: ${p => p.theme.space.lg};
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 1.25rem;
    top: 2.5rem;
    width: 1px;
    height: calc(100% + ${p => p.theme.space.lg});
    background: ${p => p.theme.border};
    z-index: 1;
  }
`;

const ChecklistCircle = styled('div')<{completed: boolean}>`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: ${p => (p.completed ? p.theme.green300 : p.theme.backgroundSecondary)};
  border: 1px solid ${p => (p.completed ? p.theme.green300 : p.theme.border)};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => (p.completed ? p.theme.white : p.theme.subText)};
  margin-right: 1rem;
  flex-shrink: 0;
  z-index: 2;
`;

const ToolConnected = styled('div')`
  margin-left: 8px;
  height: 8px;
  width: 8px;
  background: ${p => p.theme.tokens.graphics.success};
  border-radius: 50%;
`;
