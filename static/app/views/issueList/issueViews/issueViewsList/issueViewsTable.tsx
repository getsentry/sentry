import {useModal} from '@sentry/scraps/modal';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {CreateIssueViewModal} from 'sentry/views/issueList/issueViews/createIssueViewModal';
import {RenameIssueViewModal} from 'sentry/views/issueList/issueViews/renameIssueViewModal';
import {
  canEditIssueView,
  confirmDeleteIssueView,
} from 'sentry/views/issueList/issueViews/utils';
import {
  GroupSearchViewCreatedBy,
  type GroupSearchView,
} from 'sentry/views/issueList/types';
import {useHasIssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/useHasIssueViews';

type IssueViewsTableProps = {
  handleDeleteView: (view: GroupSearchView) => void;
  handleStarView: (view: GroupSearchView) => void;
  isError: boolean;
  isPending: boolean;
  onRenameView: (view: GroupSearchView) => void;
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
  onRenameView,
  type,
  hideCreatedBy = false,
}: IssueViewsTableProps) {
  const {openModal} = useModal();

  const organization = useOrganization();
  const user = useUser();
  const hasIssueViews = useHasIssueViews();

  return (
    <SavedEntityTable
      columns={issueViewColumns(hideCreatedBy)}
      data-test-id={`table-${type}`}
      header={
        <SavedEntityTable.Header>
          <SavedEntityTable.HeaderCell />
          <SavedEntityTable.HeaderCell divider={false}>
            {t('Name')}
          </SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Project')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Environments')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Query')}</SavedEntityTable.HeaderCell>
          {!hideCreatedBy && (
            <SavedEntityTable.HeaderCell>{t('Creator')}</SavedEntityTable.HeaderCell>
          )}
          <SavedEntityTable.HeaderCell>{t('Last Viewed')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Created')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell>{t('Stars')}</SavedEntityTable.HeaderCell>
          <SavedEntityTable.HeaderCell />
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
            <SavedEntityTable.Cell hasButton>
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
              <SavedEntityTable.CellTimeSince date={view.dateCreated} />
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
                    key: 'rename',
                    label: t('Rename'),
                    onAction: () => {
                      openModal(props => (
                        <RenameIssueViewModal
                          {...props}
                          view={view}
                          analyticsSurface="issue-views-list"
                          onRename={onRenameView}
                        />
                      ));
                    },
                    hidden: !canEdit || !hasIssueViews,
                  },
                  {
                    key: 'duplicate',
                    label: t('Duplicate'),
                    onAction: () => {
                      openModal(props => (
                        <CreateIssueViewModal
                          {...props}
                          {...view}
                          name={`${view.name} (Copy)`}
                          analyticsSurface="issue-views-list"
                        />
                      ));
                    },
                    hidden: !hasIssueViews,
                  },
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
                        handleDelete: () => {
                          handleDeleteView(view);
                        },
                        groupSearchView: view,
                      });
                    },
                    hidden: !canEdit,
                  },
                ]}
              />
            </SavedEntityTable.Cell>
          </SavedEntityTable.Row>
        );
      })}
    </SavedEntityTable>
  );
}

function issueViewColumns(hideCreatedBy: boolean): TableColumnConfig[] {
  return [
    {key: 'star', width: '40px'},
    {key: 'name', width: {zero: '30%', xl: '20%'}},
    {
      key: 'project',
      visible: {zero: false, xl: true},
      width: 'minmax(auto, 120px)',
    },
    {
      key: 'envs',
      visible: {zero: false, '3xl': true},
      width: 'minmax(auto, 120px)',
    },
    {key: 'query', width: 'minmax(0, 1fr)'},
    ...(hideCreatedBy
      ? []
      : [
          {
            key: 'creator',
            visible: {zero: false, xl: true},
            width: 'auto',
          } satisfies TableColumnConfig,
        ]),
    {
      key: 'last-visited',
      visible: {zero: false, '3xl': true},
      width: 'auto',
    },
    {key: 'created', visible: {zero: false, '3xl': true}, width: 'auto'},
    {
      key: 'stars',
      visible: {zero: false, '3xl': true},
      width: 'minmax(80px, max-content)',
    },
    {key: 'actions', width: '48px'},
  ];
}
