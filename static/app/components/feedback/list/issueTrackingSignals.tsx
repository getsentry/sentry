import useExternalIssueDataFeedback from 'sentry/components/feedback/list/useHasLinkedIssues';
import type {
  IntegrationComponent,
  PluginActionComponent,
  PluginIssueComponent,
  SentryAppIssueComponent,
} from 'sentry/components/group/externalIssuesList/types';
import {Tooltip} from 'sentry/components/tooltip';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {
  getIntegrationDisplayName,
  getIntegrationIcon,
} from 'sentry/utils/integrationUtil';

interface Props {
  group: Group;
}

function getPluginNames(pluginIssue: PluginIssueComponent | PluginActionComponent) {
  if (Array.isArray(pluginIssue.props.plugin)) {
    return {
      name: pluginIssue.props.plugin[0],
      icon: '',
    };
  }
  return {
    name: pluginIssue.props.plugin.name ?? '',
    icon: pluginIssue.props.plugin.slug ?? '',
  };
}

function getIntegrationNames(integrationIssue: IntegrationComponent) {
  const icon = integrationIssue.props.externalIssue
    ? integrationIssue.props.externalIssue.integrationKey
    : '';
  const name = integrationIssue.props.externalIssue
    ? getIntegrationDisplayName(integrationIssue.props.externalIssue.integrationKey)
    : '';

  return {
    name,
    icon,
  };
}

function getAppIntegrationNames(integrationIssue: SentryAppIssueComponent) {
  return {
    name: integrationIssue.props.sentryApp.name,
    icon: integrationIssue.key ?? '',
  };
}

export default function IssueTrackingSignals({group}: Props) {
  const {linkedIssues} = useExternalIssueDataFeedback({
    group,
    event: {} as Event,
    project: group.project,
  });

  if (!linkedIssues.length) {
    return null;
  }

  if (linkedIssues.length > 1) {
    return (
      <Tooltip
        title={t('Linked Tickets: %d', linkedIssues.length)}
        containerDisplayMode="flex"
      >
        <IconLink size="xs" />
      </Tooltip>
    );
  }

  const issue = linkedIssues[0]!;
  const {name, icon} = {
    'plugin-issue': getPluginNames,
    'plugin-actions': getPluginNames,
    'integration-issue': getIntegrationNames,
    'sentry-app-issue': getAppIntegrationNames,
    // @ts-expect-error TS(2551): Property 'plugin-action' does not exist on type '{... Remove this comment to see the full error message
  }[issue.type](issue) ?? {name: '', icon: undefined};

  return (
    <Tooltip title={t('Linked %s Issue', name)} containerDisplayMode="flex">
      {getIntegrationIcon(icon, 'xs')}
    </Tooltip>
  );
}
