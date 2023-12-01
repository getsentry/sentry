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
