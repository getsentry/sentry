import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {IssueCategory} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  project: Project;
  ruleId: string;
}

export function UptimeIssues({project, ruleId}: Props) {
  const organization = useOrganization();

  // TODO(davidenwang): Replace this with an actual query for the specific uptime alert rule
  const query = `issue.category:${IssueCategory.UPTIME} tags[uptime_rule]:${ruleId}`;

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
      orgSlug={organization.slug}
      queryParams={{
        query,
        project: project.id,
        limit: 20,
      }}
      renderEmptyMessage={emptyMessage}
    />
  );
}
