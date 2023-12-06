import {
  ExternalIssueComponent,
  IntegrationComponent,
  PluginActionComponent,
  PluginIssueComponent,
  SentryAppIssueComponent,
} from 'sentry/components/group/externalIssuesList/types';
import useExternalIssueData from 'sentry/components/group/externalIssuesList/useExternalIssueData';
import {Tooltip} from 'sentry/components/tooltip';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Event, Group} from 'sentry/types';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

interface Props {
  group: Group;
}

function filterLinkedPlugins(actions: ExternalIssueComponent[]) {
  // Plugins: need to do some extra logic to detect if the issue is linked,
  // by checking if there exists an issue object
  const plugins = actions.filter(
    a =>
      (a.type === 'plugin-issue' || a.type === 'plugin-action') &&
      'issue' in a.props.plugin
  );

  // Non plugins: can read directly from the `hasLinkedIssue` property
  const nonPlugins = actions.filter(
    a => a.hasLinkedIssue && !(a.type === 'plugin-issue' || a.type === 'plugin-action')
  );

  return plugins.concat(nonPlugins);
}

function getPluginNames(pluginIssue: PluginIssueComponent | PluginActionComponent) {
  return {
    name: pluginIssue.props.plugin.name ?? '',
    icon: pluginIssue.props.plugin.slug ?? '',
  };
}

function getIntegrationNames(integrationIssue: IntegrationComponent) {
  if (!integrationIssue.props.configurations.length) {
    return {name: '', icon: ''};
  }

  return {
    name: integrationIssue.props.configurations[0].provider.name ?? '',
    icon: integrationIssue.key ?? '',
  };
}

function getAppIntegrationNames(integrationIssue: SentryAppIssueComponent) {
  return {
    name: integrationIssue.props.sentryApp.name,
    icon: integrationIssue.key ?? '',
  };
}

export default function IssueTrackingSignals({group}: Props) {
  const {actions} = useExternalIssueData({
    group,
    event: {} as Event,
    project: group.project,
  });

  const linkedIssues = filterLinkedPlugins(actions);

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

  const issue = linkedIssues[0];
  const {name, icon} = {
    'plugin-issue': getPluginNames,
    'plugin-actions': getPluginNames,
    'integration-issue': getIntegrationNames,
    'sentry-app-issue': getAppIntegrationNames,
  }[issue.type](issue) ?? {name: '', icon: undefined};

  return (
    <Tooltip title={t('Linked %s Issue', name)} containerDisplayMode="flex">
      {getIntegrationIcon(icon, 'xs')}
    </Tooltip>
  );
}
