import styled from '@emotion/styled';

import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  canEditIssueView,
  confirmDeleteIssueView,
} from 'sentry/views/issueList/issueViews/utils';
import type {GroupSearchView} from 'sentry/views/issueList/types';

type IssueViewsTableProps = {
  handleDeleteView: (view: GroupSearchView) => void;
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
  handleDeleteView,
  type,
  hideCreatedBy = false,
}: IssueViewsTableProps) {
  const organization = useOrganization();
  const user = useUser();

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
            {t('Envs')}
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
          <SavedEntityTable.HeaderCell key="stars" noBorder>
            {t('Stars')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell key="actions" />
        </SavedEntityTable.Header>
      }
      isLoading={isPending}
      isEmpty={views.length === 0}
      isError={isError}
      emptyMessage={t('No saved views found')}
    >
      {views.map((view, index) => {
        const canEdit = canEditIssueView({groupSearchView: view, user});

        return (
          <SavedEntityTable.Row
            key={view.id}
            isFirst={index === 0}
            data-test-id={`table-${type}-row-${index}`}
          >
            <SavedEntityTable.Cell hasButton>
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
            <SavedEntityTable.Cell hasButton>
              <SavedEntityTable.CellActions
                items={[
                  {
                    key: 'delete',
                    label: t('Delete'),
                    priority: 'danger',
                    onAction: () => {
                      confirmDeleteIssueView({
                        handleDelete: () => handleDeleteView(view),
                        groupSearchView: view,
                      });
                    },
                    disabled: !canEdit,
                    details: canEdit
                      ? undefined
                      : t('You do not have permission to delete this view.'),
                  },
                ]}
              />
            </SavedEntityTable.Cell>
          </SavedEntityTable.Row>
        );
      })}
    </SavedEntityTableWithColumns>
  );
}

const SavedEntityTableWithColumns = styled(SavedEntityTable)<{hideCreatedBy?: boolean}>`
  grid-template-columns:
    40px 20% minmax(auto, 120px) minmax(auto, 120px) minmax(0, 1fr)
    auto auto auto auto;
`;
