import styled from '@emotion/styled';

import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type IssueViewsTableProps = {
  handleStarView: (view: GroupSearchView) => void;
  isError: boolean;
  isPending: boolean;
  type: string;
  views: GroupSearchView[];
  hideCreatedBy?: boolean;
};

export function IssueViewsTable({
  views,
  isPending,
  isError,
  handleStarView,
  type,
  hideCreatedBy = false,
}: IssueViewsTableProps) {
  const organization = useOrganization();

  return (
    <SavedEntityTableWithColumns
      data-test-id={`table-${type}`}
      header={
        <SavedEntityTable.Header>
          <SavedEntityTable.HeaderCell key="star" />
          <SavedEntityTable.HeaderCell key="name">
            {t('Name')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="project">
            {t('Project')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="envs">
            {t('Environments')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="query">
            {t('Query')}
          </SavedEntityTable.HeaderCell>
          {!hideCreatedBy && (
            <SavedEntityTable.HeaderCell key="creator">
              {t('Creator')}
            </SavedEntityTable.HeaderCell>
          )}
          <SavedEntityTable.HeaderCell key="last-visited">
            {t('Last Viewed')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="stars">
            {t('Stars')}
          </SavedEntityTable.HeaderCell>
        </SavedEntityTable.Header>
      }
      isLoading={isPending}
      isEmpty={views.length === 0}
      isError={isError}
      emptyMessage={t('No saved views found')}
    >
      {views.map((view, index) => (
        <SavedEntityTable.Row
          key={view.id}
          isFirst={index === 0}
          data-test-id={`table-${type}-row-${index}`}
        >
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellStar
              isStarred={view.starred}
              onClick={() => {
                handleStarView(view);
              }}
            />
          </SavedEntityTable.Cell>
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
            <SavedEntityTable.CellEnvironments environments={view.environments} />
          </SavedEntityTable.Cell>
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellQuery query={view.query} />
          </SavedEntityTable.Cell>
          {!hideCreatedBy && (
            <SavedEntityTable.Cell>
              <SavedEntityTable.CellUser user={view.createdBy} />
            </SavedEntityTable.Cell>
          )}
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellTimeSince date={view.lastVisited} />
          </SavedEntityTable.Cell>
          <SavedEntityTable.Cell>
            <SavedEntityTable.CellTextContent>
              {view.stars.toLocaleString()}
            </SavedEntityTable.CellTextContent>
          </SavedEntityTable.Cell>
        </SavedEntityTable.Row>
      ))}
    </SavedEntityTableWithColumns>
  );
}

const SavedEntityTableWithColumns = styled(SavedEntityTable)`
  grid-template-columns:
    40px 20% minmax(auto, 120px) minmax(auto, 120px) minmax(0, 1fr) auto
    auto auto;
`;
