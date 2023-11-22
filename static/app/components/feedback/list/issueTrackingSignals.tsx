import {FeedbackIcon} from 'sentry/components/feedback/list/feedbackListItem';
import useExternalIssueData from 'sentry/components/group/externalIssuesList/useExternalIssueData';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Event, Group, Project} from 'sentry/types';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

interface Props {
  event: Event;
  group: Group;
  project: Project;
}

export default function IssueTrackingSignals({group, event, project}: Props) {
  const {actions} = useExternalIssueData({
    group,
    event,
    project,
  });

  const linkedIssues = actions.filter(
    a => a.hasLinkedIssue && a.key !== 'plugin-issue-0'
  );

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

  const name = linkedIssues[0].key.charAt(0).toUpperCase() + linkedIssues[0].key.slice(1);

  return (
    <FeedbackIcon
      tooltipText={t('Linked %s Issue', name)}
      icon={getIntegrationIcon(linkedIssues[0].key, 'xs')}
    />
  );
}
