import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';

interface Props {
  project: Project;
  uptimeDetector: UptimeDetector;
}

export function UptimeIssues({project, uptimeDetector}: Props) {
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
        query: `detector:${uptimeDetector.id}`,
        project: project.id,
        limit: 1,
      }}
      renderEmptyMessage={emptyMessage}
      numPlaceholderRows={1}
    />
  );
}
