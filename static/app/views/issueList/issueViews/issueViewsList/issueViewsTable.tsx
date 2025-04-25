import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  canEditIssueView,
  confirmDeleteIssueView,
} from 'sentry/views/issueList/issueViews/utils';
import {
  type GroupSearchView,
  GroupSearchViewCreatedBy,
} from 'sentry/views/issueList/types';

type IssueViewsTableProps = {
  handleDeleteView: (view: GroupSearchView) => void;
  handleStarView: (view: GroupSearchView) => void;
  isError: boolean;
  isPending: boolean;
  type: GroupSearchViewCreatedBy;
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
      hideCreatedBy={hideCreatedBy}
      data-test-id={`table-${type}`}
      header={
        <SavedEntityTable.Header>
          <SavedEntityTable.HeaderCell data-column="star" />
          <SavedEntityTable.HeaderCell data-column="name">
            {t('Name')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell data-column="project">
            {t('Project')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell data-column="envs">
            {t('Environments')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell data-column="query">
            {t('Query')}
          </SavedEntityTable.HeaderCell>
          {!hideCreatedBy && (
            <SavedEntityTable.HeaderCell data-column="creator">
              {t('Creator')}
            </SavedEntityTable.HeaderCell>
          )}
          <SavedEntityTable.HeaderCell data-column="last-visited">
            {t('Last Viewed')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell data-column="stars" noBorder>
            {t('Stars')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell data-column="actions" />
        </SavedEntityTable.Header>
      }
      isLoading={isPending}
      isEmpty={views.length === 0}
      isError={isError}
      emptyMessage={t('No saved views found')}
    >
      {views.map((view, index) => {
        const canEdit = canEditIssueView({groupSearchView: view, user, organization});

        return (
          <SavedEntityTable.Row
            key={view.id}
            isFirst={index === 0}
            data-test-id={`table-${type}-row-${index}`}
          >
            <SavedEntityTable.Cell data-column="star" hasButton>
              <SavedEntityTable.CellStar
                isStarred={view.starred}
                onClick={() => {
                  trackAnalytics('issue_views.star_view', {
                    organization,
                    ownership:
                      type === GroupSearchViewCreatedBy.ME ? 'personal' : 'organization',
                    starred: !view.starred,
                    surface: 'issue-views-list',
                  });
                  handleStarView(view);
                }}
              />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="name">
              <SavedEntityTable.CellName
                to={`/organizations/${organization.slug}/issues/views/${view.id}/`}
              >
                {view.name}
              </SavedEntityTable.CellName>
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="project">
              <SavedEntityTable.CellProjects projects={view.projects} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="envs">
              <SavedEntityTable.CellEnvironments environments={view.environments} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="query">
              <SavedEntityTable.CellQuery query={view.query} />
            </SavedEntityTable.Cell>
            {!hideCreatedBy && (
              <SavedEntityTable.Cell data-column="creator">
                <SavedEntityTable.CellUser user={view.createdBy} />
              </SavedEntityTable.Cell>
            )}
            <SavedEntityTable.Cell data-column="last-visited">
              <SavedEntityTable.CellTimeSince date={view.lastVisited} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="stars">
              <SavedEntityTable.CellTextContent>
                {view.stars.toLocaleString()}
              </SavedEntityTable.CellTextContent>
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="actions" hasButton>
              <SavedEntityTable.CellActions
                items={[
                  {
                    key: 'delete',
                    label: t('Delete'),
                    priority: 'danger',
                    onAction: () => {
                      trackAnalytics('issue_views.delete_view', {
                        organization,
                        ownership:
                          type === GroupSearchViewCreatedBy.ME
                            ? 'personal'
                            : 'organization',
                        surface: 'issue-views-list',
                      });
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
  grid-template-areas: 'star name project envs query creator last-visited stars actions';
  grid-template-columns:
    40px 20% minmax(auto, 120px) minmax(auto, 120px) minmax(0, 1fr)
    auto auto auto 48px;

  ${p =>
    p.hideCreatedBy &&
    css`
      grid-template-areas: 'star name project envs query last-visited stars actions';
      grid-template-columns:
        40px 20% minmax(auto, 120px) minmax(auto, 120px) minmax(0, 1fr)
        auto auto 48px;
    `}

  @container (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-areas: 'star name project query creator actions';
    grid-template-columns: 40px 20% minmax(auto, 120px) minmax(0, 1fr) auto 48px;

    ${p =>
      p.hideCreatedBy &&
      css`
        grid-template-areas: 'star name project query creator actions';
        grid-template-columns: 40px 20% minmax(auto, 120px) minmax(0, 1fr) 48px;
      `}

    div[data-column='envs'],
    div[data-column='last-visited'],
    div[data-column='stars'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-areas: 'star name query actions';
    grid-template-columns: 40px 30% minmax(0, 1fr) 48px;

    div[data-column='envs'],
    div[data-column='last-visited'],
    div[data-column='stars'],
    div[data-column='creator'],
    div[data-column='project'] {
      display: none;
    }
  }
`;
