import {Tooltip} from '@sentry/scraps/tooltip';

import {useHasLinkedIssues} from 'sentry/components/feedback/list/useHasLinkedIssues';
import type {
  IntegrationComponent,
  SentryAppIssueComponent,
} from 'sentry/components/group/externalIssuesList/types';
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

export function IssueTrackingSignals({group}: Props) {
  const {linkedIssues} = useHasLinkedIssues({
    group,
    event: {} as Event,
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
  const {name, icon} =
    issue.type === 'integration-issue'
      ? getIntegrationNames(issue)
      : getAppIntegrationNames(issue);

  return (
    <Tooltip title={t('Linked %s Issue', name)} containerDisplayMode="flex">
      {getIntegrationIcon(icon, 'xs')}
    </Tooltip>
  );
}
