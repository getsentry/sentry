import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import ActivitySection from 'sentry/views/issueDetails/streamline/sidebar/activitySection';
import {PeopleSection} from 'sentry/views/issueDetails/streamline/sidebar/peopleSection';

type Props = {
  group: Group;
  project: Project;
  event?: Event;
};

export default function StreamlinedSidebar({group, event, project}: Props) {
  return (
    <div>
      {event && (
        <StreamlinedExternalIssueList group={group} event={event} project={project} />
      )}
      <ActivitySection group={group} />
      <PeopleSection group={group} />
    </div>
  );
}
