import styled from '@emotion/styled';

import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {getSortLabel} from 'sentry/views/issueList/utils';

type IssueViewsTableProps = {
  isError: boolean;
  isPending: boolean;
  views: GroupSearchView[];
};

export function IssueViewsTable({views, isPending, isError}: IssueViewsTableProps) {
  const organization = useOrganization();

  return (
    <SavedEntityTableWithColumns
      header={
        <SavedEntityTable.Header>
          <SavedEntityTable.HeaderCell key="star" />
          <SavedEntityTable.HeaderCell key="name">
            {t('Name')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="project">
            {t('Project')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="query">
            {t('Query')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="envs">
            {t('Envs')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="time">
            {t('Time')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="sort">
            {t('Sort')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="last-visited">
            {t('Last Viewed')}
          </SavedEntityTable.HeaderCell>
        </SavedEntityTable.Header>
      }
      isLoading={isPending}
      isEmpty={views.length === 0}
      isError={isError}
      emptyMessage={t('No saved views found')}
    >
      {views.map((view, index) => (
        <SavedEntityTable.Row key={view.id} isFirst={index === 0}>
          <SavedEntityTable.ButtonCell>
            <SavedEntityTable.CellStar isStarred onClick={() => {}} />
          </SavedEntityTable.ButtonCell>
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellName
              to={`/organizations/${organization.slug}/issues/views/${view.id}/`}
            >
              {view.name}
            </SavedEntityTable.CellName>
          </SavedEntityTable.Cell>
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellProjects projects={view.projects} />
          </SavedEntityTable.Cell>
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellQuery query={view.query} />
          </SavedEntityTable.Cell>
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellEnvironments environments={view.environments} />
          </SavedEntityTable.Cell>
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellTimeFilters timeFilters={view.timeFilters} />
          </SavedEntityTable.Cell>
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellTextContent>
              {getSortLabel(view.querySort)}
            </SavedEntityTable.CellTextContent>
          </SavedEntityTable.Cell>
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellTimeSince date={view.lastVisited} />
          </SavedEntityTable.Cell>
        </SavedEntityTable.Row>
      ))}
    </SavedEntityTableWithColumns>
  );
}

const SavedEntityTableWithColumns = styled(SavedEntityTable)`
  grid-template-columns: 40px 20% 100px minmax(0, 1fr) 100px 80px 90px auto;
`;
