import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Tooltip} from '@sentry/scraps/tooltip';

import {updateDashboardFavorite} from 'sentry/actionCreators/dashboards';
import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {openConfirmModal} from 'sentry/components/confirm';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {SavedEntityTable} from 'sentry/components/savedEntityTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {useDeleteDashboard} from 'sentry/views/dashboards/hooks/useDeleteDashboard';
import {useDuplicateDashboard} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import {useResetDashboardLists} from 'sentry/views/dashboards/hooks/useResetDashboardLists';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

export interface DashboardTableProps {
  cursorKey: string;
  dashboards: DashboardListItem[];
  isLoading: boolean;
  title: string;
  pageLinks?: string;
}

export function DashboardTable({
  dashboards,
  isLoading,
  title,
  pageLinks,
  cursorKey,
}: DashboardTableProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const navigate = useNavigate();
  const resetDashboardLists = useResetDashboardLists();
  const handleDuplicateDashboard = useDuplicateDashboard({
    onSuccess: resetDashboardLists,
  });
  const handleDeleteDashboard = useDeleteDashboard({
    onSuccess: resetDashboardLists,
  });

  const handleCursor: CursorHandler = (_cursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [cursorKey]: _cursor},
    });
  };

  return (
    <Container>
      <TableHeading>{title}</TableHeading>
      <SavedEntityTableWithColumns
        isLoading={isLoading}
        isError={false}
        header={
          <SavedEntityTable.Header>
            <SavedEntityTable.HeaderCell data-column="star" />
            <SavedEntityTable.HeaderCell data-column="name" divider={false}>
              {t('Name')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="project">
              {t('Project')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="envs">
              {t('Envs')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="filter">
              {t('Filter')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="num-widgets">
              {t('Widgets')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="created-by">
              {t('Creator')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="last-visited">
              {t('Last Viewed')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="created">
              {t('Date Created')}
            </SavedEntityTable.HeaderCell>
            <SavedEntityTable.HeaderCell data-column="actions" />
          </SavedEntityTable.Header>
        }
        isEmpty={dashboards.length === 0}
        // TODO: DAIN-715 Update empty message
        emptyMessage={t('No dashboards found')}
      >
        {dashboards.map((dashboard, index) => (
          <SavedEntityTable.Row
            key={dashboard.id}
            isFirst={index === 0}
            data-test-id={`table-row-${index}`}
          >
            <SavedEntityTable.Cell hasButton data-column="star">
              <SavedEntityTable.CellStar
                isStarred={dashboard.isFavorited ?? false}
                onClick={async () => {
                  await updateDashboardFavorite(
                    api,
                    queryClient,
                    organization,
                    dashboard.id,
                    !dashboard.isFavorited
                  );
                  resetDashboardLists();
                }}
              />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="name">
              <SavedEntityTable.CellName
                to={`/organizations/${organization.slug}/dashboards/${dashboard.id}`}
              >
                {dashboard.title}
              </SavedEntityTable.CellName>
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="project">
              <SavedEntityTable.CellProjects projects={dashboard.projects} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="envs">
              <SavedEntityTable.CellEnvironments environments={dashboard.environment} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="filter">
              <SavedEntityTable.CellQuery query={getDashboardFiltersQuery(dashboard)} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="num-widgets">
              {dashboard.widgetPreview.length}
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="created-by">
              {dashboard.createdBy === null ? (
                <Tooltip title="Sentry">
                  <ActivityAvatar type="system" size={20} />
                </Tooltip>
              ) : dashboard.createdBy ? (
                <UserAvatar user={dashboard.createdBy} hasTooltip />
              ) : null}
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="last-visited">
              <SavedEntityTable.CellTimeSince date={dashboard.lastVisited ?? null} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="created">
              <SavedEntityTable.CellTimeSince date={dashboard.dateCreated ?? null} />
            </SavedEntityTable.Cell>
            <SavedEntityTable.Cell data-column="actions" hasButton>
              <DashboardCreateLimitWrapper>
                {({
                  hasReachedDashboardLimit,
                  isLoading: isLoadingDashboardsLimit,
                  limitMessage,
                }) => (
                  <SavedEntityTable.CellActions
                    items={[
                      {
                        key: 'duplicate',
                        label: t('Duplicate'),
                        onAction: () => handleDuplicateDashboard(dashboard, 'table'),
                        disabled: hasReachedDashboardLimit || isLoadingDashboardsLimit,
                        tooltip: limitMessage,
                      },
                      ...(dashboard.createdBy === null
                        ? []
                        : [
                            {
                              key: 'delete',
                              label: t('Delete'),
                              priority: 'danger' as const,
                              onAction: () => {
                                openConfirmModal({
                                  message: t(
                                    'Are you sure you want to delete this dashboard?'
                                  ),
                                  priority: 'danger',
                                  onConfirm: () =>
                                    handleDeleteDashboard(dashboard, 'table'),
                                });
                              },
                            },
                          ]),
                    ]}
                  />
                )}
              </DashboardCreateLimitWrapper>
            </SavedEntityTable.Cell>
          </SavedEntityTable.Row>
        ))}
      </SavedEntityTableWithColumns>
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Container>
  );
}

function getDashboardFiltersQuery(dashboard: DashboardListItem) {
  // Dashboards only currently support release filters
  return dashboard.filters?.release
    ? `release:[${dashboard.filters.release.join(',')}]`
    : '';
}

const Container = styled('div')`
  container-type: inline-size;
`;

// TODO: DAIN-719 Update the widths to be consistent with mockup
const SavedEntityTableWithColumns = styled(SavedEntityTable)`
  grid-template-areas: 'star name project envs filter num-widgets created-by last-visited created actions';
  grid-template-columns:
    40px 20% minmax(auto, 120px) minmax(auto, 120px) minmax(auto, 200px)
    minmax(auto, 120px) 80px auto auto 48px;
`;

const TableHeading = styled('h2')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.theme.font.size.xl};
  margin-top: ${space(3)};
  margin-bottom: ${space(1.5)};
`;
