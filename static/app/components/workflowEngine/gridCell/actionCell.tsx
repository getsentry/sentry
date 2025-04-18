import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCircledNumber} from 'sentry/components/iconCircledNumber';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import {ActionType} from 'sentry/types/workflowEngine/actions';

const ICON_SIZE = 20;
const ActionMetadata: Partial<Record<ActionType, {icon: React.ReactNode; name: string}>> =
  {
    [ActionType.AZURE_DEVOPS]: {
      name: t('Azure DevOps'),
      icon: <PluginIcon pluginId="vsts" size={ICON_SIZE} />,
    },
    [ActionType.DISCORD]: {
      name: t('Discord'),
      icon: <PluginIcon pluginId={'discord'} size={ICON_SIZE} />,
    },
    [ActionType.EMAIL]: {name: t('Email'), icon: <IconMail size="md" />},
    [ActionType.GITHUB]: {
      name: t('GitHub'),
      icon: <PluginIcon pluginId="github" size={ICON_SIZE} />,
    },
    [ActionType.GITHUB_ENTERPRISE]: {
      name: t('GitHub Enterprise'),
      icon: <PluginIcon pluginId="github_enterprise" size={ICON_SIZE} />,
    },
    [ActionType.JIRA]: {
      name: t('JIRA'),
      icon: <PluginIcon pluginId="jira" size={ICON_SIZE} />,
    },
    [ActionType.JIRA_SERVER]: {
      name: t('JIRA Server'),
      icon: <PluginIcon pluginId="jira_server" size={ICON_SIZE} />,
    },
    [ActionType.MSTEAMS]: {
      name: t('Teams'),
      icon: <PluginIcon pluginId="msteams" size={ICON_SIZE} />,
    },
    [ActionType.OPSGENIE]: {
      name: t('Ops Genie'),
      icon: <PluginIcon pluginId="opsgenie" size={ICON_SIZE} />,
    },
    [ActionType.PAGERDUTY]: {
      name: t('Pager Duty'),
      icon: <PluginIcon pluginId="pagerduty" size={ICON_SIZE} />,
    },
    [ActionType.PLUGIN]: {
      name: t('Plugin'),
      icon: <PluginIcon pluginId="placeholder" size={ICON_SIZE} />,
    },
    [ActionType.SENTRY_APP]: {
      name: t('Sentry App'),
      icon: <PluginIcon pluginId="sentry" size={ICON_SIZE} />,
    },
    [ActionType.SLACK]: {
      name: t('Slack'),
      icon: <PluginIcon pluginId="slack" size={ICON_SIZE} />,
    },
    [ActionType.WEBHOOK]: {
      name: t('Webhook'),
      icon: <PluginIcon pluginId="webhooks" size={ICON_SIZE} />,
    },
  };

type ActionCellProps = {
  actions: ActionType[];
  disabled?: boolean;
};

export function ActionCell({actions, disabled}: ActionCellProps) {
  if (!actions || actions.length === 0) {
    return <EmptyCell />;
  }
  if (actions.length === 1 && actions[0]) {
    const {name, icon} = ActionMetadata[actions[0]]!;
    return (
      <Flex align="center" gap={space(0.75)}>
        <IconContainer>{icon}</IconContainer>
        {name}
      </Flex>
    );
  }
  const actionsList = actions
    .map(action => ActionMetadata[action]?.name)
    .filter(x => x)
    .join(', ');
  return (
    <ActionContainer align="center" gap={space(0.75)}>
      <IconContainer>
        <IconCircledNumber number={actions.length} />
      </IconContainer>
      <Tooltip title={actionsList} disabled={disabled}>
        <ActionsList>{actionsList}</ActionsList>
      </Tooltip>
    </ActionContainer>
  );
}

const ActionContainer = styled(Flex)`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const ActionsList = styled('span')`
  ${p => p.theme.tooltipUnderline()};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: flex;
`;

const IconContainer = styled('div')`
  display: flex;
  justify-content: center;
  width: 20px;
  line-height: 0;
`;
