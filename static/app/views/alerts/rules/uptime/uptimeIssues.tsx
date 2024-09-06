import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {IssueCategory} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getUtcDateString} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface Props {
  project: Project;
}

export function UptimeIssues({project}: Props) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {start, end, period} = selection.datetime;
  const timeProps =
    start && end
      ? {
          start: getUtcDateString(start),
          end: getUtcDateString(end),
        }
      : {
          statsPeriod: period,
        };

  // TODO(davidenwang): Replace this with an actual query for the specific uptime alert rule
  const query = `issue.category:${IssueCategory.UPTIME}`;

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
        ...timeProps,
      }}
      renderEmptyMessage={emptyMessage}
    />
  );
}
