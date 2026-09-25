import styled from '@emotion/styled';
import type {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {updateDashboardPermissions} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {openConfirmModal} from 'sentry/components/confirm';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {
  COL_WIDTH_UNDEFINED,
  GridEditable,
  type GridColumnOrder,
  type GridColumnSort,
} from 'sentry/components/tables/gridEditable';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconCopy,
  IconDelete,
  IconEllipsis,
  IconGroup,
  IconInput,
  IconStar,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {withApi} from 'sentry/utils/withApi';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {useOpenEditAccessModal} from 'sentry/views/dashboards/editAccessModal';
import {useDeleteDashboard} from 'sentry/views/dashboards/hooks/useDeleteDashboard';
import {useDuplicateDashboard} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import {useToggleDashboardFavorite} from 'sentry/views/dashboards/hooks/useToggleDashboardFavorite';
import {useOpenRenameDashboardModal} from 'sentry/views/dashboards/renameDashboardModal';
import type {
  DashboardDetails,
  DashboardListItem,
  DashboardPermissions,
} from 'sentry/views/dashboards/types';
import {PREBUILT_DASHBOARD_LABEL} from 'sentry/views/dashboards/types';

type Props = {
  api: Client;
  dashboards: DashboardListItem[] | undefined;
  isOnlyPrebuilt: boolean;
  location: Location;
  onDashboardsChange: () => void;
  organization: Organization;
  isLoading?: boolean;
};

enum ResponseKeys {
  NAME = 'title',
  WIDGETS = 'widgetDisplay',
  OWNER = 'createdBy',
  CREATED = 'dateCreated',
  FAVORITE = 'isFavorited',
  DESCRIPTION = 'description',
  LAST_VISITED = 'lastVisited',
}

const SortKeys = {
  title: {asc: 'title', desc: '-title'},
  dateCreated: {asc: 'dateCreated', desc: '-dateCreated'},
  createdBy: {asc: 'mydashboards', desc: 'mydashboards'},
};

type FavoriteButtonProps = {
  dashboard: DashboardListItem;
  isFavorited: boolean;
};

function FavoriteButton({isFavorited, dashboard}: FavoriteButtonProps) {
  const toggleFavorite = useToggleDashboardFavorite();

  return (
    <Button
      aria-label={t('Favorite Button')}
      size="zero"
      variant="transparent"
      icon={
        <IconStar
          variant={isFavorited ? 'warning' : 'muted'}
          isSolid={isFavorited}
          aria-label={isFavorited ? t('Unstar') : t('Star')}
          size="sm"
        />
      }
      onClick={() => toggleFavorite({dashboard, shouldFavorite: !isFavorited})}
    />
  );
}

function DashboardRowActions({
  dashboard,
  onChangeEditAccess,
  onDelete,
  onDuplicate,
  onRename,
}: {
  dashboard: DashboardListItem;
  onChangeEditAccess: (newDashboardPermissions: DashboardPermissions) => void;
  onDelete: ReturnType<typeof useDeleteDashboard>;
  onDuplicate: ReturnType<typeof useDuplicateDashboard>;
  onRename: () => void;
}) {
  const openEditAccess = useOpenEditAccessModal(dashboard, onChangeEditAccess);
  const openRename = useOpenRenameDashboardModal(dashboard, onRename, 'table');
  const isPrebuiltDashboard = defined(dashboard.prebuiltId);

  return (
    <DashboardCreateLimitWrapper>
      {({hasReachedDashboardLimit, isLoading, limitMessage}) => {
        const isDuplicateDisabled = hasReachedDashboardLimit || isLoading;
        const items: MenuItemProps[] = [
          ...(isPrebuiltDashboard
            ? []
            : [
                {
                  key: 'rename',
                  label: t('Rename Dashboard'),
                  leadingItems: <IconInput />,
                  onAction: openRename,
                },
                {
                  key: 'view-permissions',
                  label: t('View Permissions'),
                  leadingItems: <IconGroup />,
                  onAction: openEditAccess,
                },
              ]),
          {
            key: 'duplicate',
            label: t('Duplicate Dashboard'),
            leadingItems: <IconCopy />,
            disabled: isDuplicateDisabled,
            tooltip: isDuplicateDisabled ? limitMessage : undefined,
            onAction: () =>
              openConfirmModal({
                message: t('Are you sure you want to duplicate this dashboard?'),
                onConfirm: () => onDuplicate(dashboard, 'table'),
              }),
          },
          {
            key: 'delete',
            label: t('Delete Dashboard'),
            leadingItems: <IconDelete />,
            priority: 'danger',
            disabled: isPrebuiltDashboard,
            tooltip: isPrebuiltDashboard
              ? tct('[label] dashboards cannot be deleted', {
                  label: PREBUILT_DASHBOARD_LABEL,
                })
              : undefined,
            onAction: () =>
              openConfirmModal({
                message: tct('Are you sure you want to delete the [title] dashboard?', {
                  title: <strong>{dashboard[ResponseKeys.NAME]}</strong>,
                }),
                priority: 'danger',
                onConfirm: () => onDelete(dashboard, 'table'),
              }),
          },
        ];

        return (
          <DropdownMenu
            trigger={triggerProps => (
              <Button
                {...triggerProps}
                aria-label={t('Dashboard actions')}
                size="sm"
                variant="transparent"
                icon={<IconEllipsis />}
                data-test-id="dashboard-actions"
              />
            )}
            items={items}
            position="bottom-end"
            size="sm"
            strategy="fixed"
          />
        );
      }}
    </DashboardCreateLimitWrapper>
  );
}

function DashboardTable({
  api,
  organization,
  location,
  dashboards,
  onDashboardsChange,
  isLoading,
  isOnlyPrebuilt,
}: Props) {
  const handleDuplicateDashboard = useDuplicateDashboard({
    onSuccess: onDashboardsChange,
  });
  const handleDeleteDashboard = useDeleteDashboard({
    onSuccess: onDashboardsChange,
  });
  const handleChangeEditAccess =
    (dashboard: DashboardListItem) => (newDashboardPermissions: DashboardPermissions) => {
      const dashboardCopy = cloneDeep(dashboard);
      dashboardCopy.permissions = newDashboardPermissions;

      updateDashboardPermissions(api, organization.slug, dashboardCopy).then(
        (newDashboard: DashboardDetails) => {
          onDashboardsChange();
          addSuccessMessage(t('Dashboard Edit Access updated.'));
          return newDashboard;
        }
      );
    };
  const hasUserLastVisited = organization.features.includes(
    'dashboards-user-last-visited'
  );

  // TODO: When `dashboards-user-last-visited` is fully rolled out, delete the
  // flag-off `columnOrder` branch below, the `createdBy` SortKeys entry and its
  // special case in `getColumnSort`, and the `mydashboards` default/fallback.
  const columnOrder: Array<GridColumnOrder<ResponseKeys>> = hasUserLastVisited
    ? [
        {key: ResponseKeys.NAME, name: t('Name'), width: COL_WIDTH_UNDEFINED},
        ...(isOnlyPrebuilt
          ? [
              {
                key: ResponseKeys.DESCRIPTION,
                name: t('Description'),
                width: COL_WIDTH_UNDEFINED,
              },
            ]
          : []),
        {key: ResponseKeys.WIDGETS, name: t('Widgets'), width: COL_WIDTH_UNDEFINED},
        ...(isOnlyPrebuilt
          ? []
          : [{key: ResponseKeys.OWNER, name: t('Owner'), width: COL_WIDTH_UNDEFINED}]),
        ...(isOnlyPrebuilt
          ? []
          : [
              {key: ResponseKeys.CREATED, name: t('Created'), width: COL_WIDTH_UNDEFINED},
            ]),
        {
          key: ResponseKeys.LAST_VISITED,
          name: t('Last Visited'),
          width: COL_WIDTH_UNDEFINED,
        },
      ]
    : [
        // Legacy layout; delete this when hasUserLastVisited is cleaned up
        {key: ResponseKeys.NAME, name: t('Name'), width: COL_WIDTH_UNDEFINED},
        {key: ResponseKeys.WIDGETS, name: t('Widgets'), width: COL_WIDTH_UNDEFINED},
        {key: ResponseKeys.OWNER, name: t('Owner'), width: COL_WIDTH_UNDEFINED},
        {key: ResponseKeys.CREATED, name: t('Created'), width: COL_WIDTH_UNDEFINED},
      ];

  function getColumnSort(column: GridColumnOrder<string>): GridColumnSort | undefined {
    if (!(column.key in SortKeys)) {
      return;
    }

    const sortKey = SortKeys[column.key as keyof typeof SortKeys];
    const urlSort = decodeScalar(
      location.query.sort,
      hasUserLastVisited ? 'recentlyViewed' : 'mydashboards'
    );
    const currentDirection =
      urlSort === sortKey.asc ? 'asc' : urlSort === sortKey.desc ? 'desc' : undefined;
    const isCurrentSort = currentDirection !== undefined;

    return {
      align: 'left',
      direction:
        !isCurrentSort || column.key === 'createdBy' ? undefined : currentDirection,
      to: {
        ...location,
        query: {
          ...location.query,
          sort: isCurrentSort && currentDirection === 'asc' ? sortKey.desc : sortKey.asc,
        },
      },
    };
  }

  const renderBodyCell = (
    column: GridColumnOrder<string>,
    dataRow: DashboardListItem
  ) => {
    if (column.key === ResponseKeys.FAVORITE) {
      return (
        <FavoriteButton
          isFavorited={dataRow[ResponseKeys.FAVORITE] ?? false}
          dashboard={dataRow}
          key={dataRow.id}
        />
      );
    }

    if (column.key === ResponseKeys.NAME) {
      return (
        <Text ellipsis variant="accent">
          <Link to={`/organizations/${organization.slug}/dashboard/${dataRow.id}/`}>
            {dataRow[ResponseKeys.NAME]}
          </Link>
        </Text>
      );
    }

    if (column.key === ResponseKeys.WIDGETS) {
      return dataRow[ResponseKeys.WIDGETS].length;
    }

    if (column.key === ResponseKeys.OWNER) {
      return dataRow[ResponseKeys.OWNER] ? (
        <Flex justify="between" align="center" gap="3xl">
          <UserAvatar hasTooltip user={dataRow[ResponseKeys.OWNER]} size={26} />
        </Flex>
      ) : (
        <Flex justify="between" align="center" gap="3xl">
          <Tooltip title={PREBUILT_DASHBOARD_LABEL}>
            <ActivityAvatar type="system" size={26} />
          </Tooltip>
        </Flex>
      );
    }

    // TODO: only last visited will show renderActions. Delete ternary below
    // when hasUserLastVisited is cleaned up.
    if (column.key === ResponseKeys.CREATED) {
      return (
        <Flex justify="between" align="center" gap="3xl">
          <DateSelected>
            {dataRow[ResponseKeys.CREATED] ? (
              <DateStatus>
                <TimeSince date={dataRow[ResponseKeys.CREATED]} />
              </DateStatus>
            ) : (
              <DateStatus />
            )}
          </DateSelected>
          {hasUserLastVisited ? undefined : (
            <DashboardRowActions
              dashboard={dataRow}
              onChangeEditAccess={handleChangeEditAccess(dataRow)}
              onDelete={handleDeleteDashboard}
              onDuplicate={handleDuplicateDashboard}
              onRename={onDashboardsChange}
            />
          )}
        </Flex>
      );
    }

    if (column.key === ResponseKeys.LAST_VISITED && hasUserLastVisited) {
      return (
        <Flex justify="between" align="center" gap="3xl">
          <DateSelected>
            {dataRow[ResponseKeys.LAST_VISITED] ? (
              <DateStatus>
                <TimeSince date={dataRow[ResponseKeys.LAST_VISITED]} />
              </DateStatus>
            ) : (
              <DateStatus />
            )}
          </DateSelected>
          <DashboardRowActions
            dashboard={dataRow}
            onChangeEditAccess={handleChangeEditAccess(dataRow)}
            onDelete={handleDeleteDashboard}
            onDuplicate={handleDuplicateDashboard}
            onRename={onDashboardsChange}
          />
        </Flex>
      );
    }

    if (column.key === ResponseKeys.DESCRIPTION && hasUserLastVisited) {
      return <Text ellipsis>{dataRow.description}</Text>;
    }

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return <span>{dataRow[column.key]}</span>;
  };

  return (
    <GridEditable
      data={dashboards ?? []}
      columnOrder={columnOrder}
      grid={{
        renderBodyCell,
        getColumnSort,
        // favorite column
        renderPrependColumns: (isHeader: boolean, dataRow?: any) => {
          const favoriteColumn = {
            key: ResponseKeys.FAVORITE,
            name: t('Favorite'),
          };

          if (isHeader) {
            return [
              <IconStar
                variant="warning"
                isSolid
                aria-label={t('Star Column')}
                key="favorite-header"
              />,
            ];
          }
          if (!dataRow) {
            return [];
          }
          return [renderBodyCell(favoriteColumn, dataRow) as any];
        },
        prependColumnWidths: ['max-content'],
      }}
      isLoading={isLoading}
      emptyMessage={
        <EmptyStateWarning>
          <p>{t('Sorry, no Dashboards match your filters.')}</p>
        </EmptyStateWarning>
      }
    />
  );
}

export default withApi(DashboardTable);

const DateSelected = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  grid-column-gap: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.content.primary};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.tokens.content.primary};
  padding-left: ${p => p.theme.space.md};
`;
