import {Fragment} from 'react';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import Resources from 'sentry/views/issueDetails/streamline/resources';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar';

export default function ResourcesSection({
  group,
  project,
  event,
}: {
  event: Event | undefined;
  group: Group;
  project: Project;
}) {
  const config = getConfigForIssueType(group, project);

  if (config.resources) {
    return (
      <Fragment>
        <SidebarSectionTitle>{t('Resources')}</SidebarSectionTitle>
        <Resources
          eventPlatform={event?.platform}
          group={group}
          configResources={config.resources}
        />
      </Fragment>
    );
  }
  return null;
}
