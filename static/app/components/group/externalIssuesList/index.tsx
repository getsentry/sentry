import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

export default function ExternalIssueList({group, event, project}: Props) {
  return (
    <SidebarSection.Wrap data-test-id="linked-issues">
      <SidebarSection.Title>{t('Issue Tracking')}</SidebarSection.Title>
      <SidebarSection.Content>
        <StreamlinedExternalIssueList group={group} event={event} project={project} />
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}
