import {FeedbackIcon} from 'sentry/components/feedback/list/feedbackListItem';
import useExternalIssueData from 'sentry/components/group/externalIssuesList/useExternalIssueData';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Event, Group} from 'sentry/types';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

interface Props {
  group: Group;
}

export default function IssueTrackingSignals({group}: Props) {
  const {actions} = useExternalIssueData({
    group,
    event: {} as Event,
    project: group.project,
  });

  const linkedIssues = actions.filter(a => a.hasLinkedIssue);

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
