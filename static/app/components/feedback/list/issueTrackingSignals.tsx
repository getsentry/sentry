import {FeedbackIcon} from 'sentry/components/feedback/list/feedbackListItem';
import {ExternalIssueComponent} from 'sentry/components/group/externalIssuesList/types';
import useExternalIssueData from 'sentry/components/group/externalIssuesList/useExternalIssueData';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Event, Group} from 'sentry/types';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

interface Props {
  group: Group;
}

function MutateActions(actions: ExternalIssueComponent[]) {
  // TODO: fix the `hasLinkedIssue` references. it's broken for plugin-issues and plugin-actions
  return actions;
}

export default function IssueTrackingSignals({group}: Props) {
  const {actions} = useExternalIssueData({
    group,
    event: {} as Event,
    project: group.project,
  });

  const linkedIssues = MutateActions(actions).filter(a => a.hasLinkedIssue);

  if (!linkedIssues.length) {
    return null;
  }

  if (linkedIssues.length > 1) {
    return (
      <FeedbackIcon
        tooltipText={t('Linked Tickets: %d', linkedIssues.length)}
        icon={<IconLink size="xs" />}
      />
    );
  }

  const name =
    linkedIssues[0].type === 'plugin-issue' || linkedIssues[0].type === 'plugin-action'
      ? linkedIssues[0].props.plugin.slug ?? ''
      : linkedIssues[0].key;

  return (
    <FeedbackIcon
      tooltipText={t('Linked %s Issue', name)}
      icon={getIntegrationIcon(name, 'xs')}
    />
  );
}
