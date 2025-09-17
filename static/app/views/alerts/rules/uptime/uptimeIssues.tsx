import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

import type {UptimeRule} from './types';

interface Props {
  project: Project;
  uptimeRule: UptimeRule;
}

export function UptimeIssues({project, uptimeRule}: Props) {
  // TODO(epurkhiser): We need a better way to query for uptime issues, using
  // the title is brittle and means when the user changes the URL we'll have to
  // wait for a new event before the issue matches again.
  const query = `issue.type:${IssueType.UPTIME_DOMAIN_FAILURE} title:"Downtime detected for ${uptimeRule.url}"`;

  const emptyMessage = () => {
    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning>
            <p>{t('No issues relating to this uptime alert have been found.')}</p>
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  };

  return (
    <GroupList
      withChart={false}
      withPagination={false}
      withColumns={['assignee']}
      queryParams={{
        query,
        project: project.id,
        limit: 1,
      }}
      renderEmptyMessage={emptyMessage}
      numPlaceholderRows={1}
    />
  );
}
