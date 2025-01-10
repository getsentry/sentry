import {useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';

import {
  createDashboard,
  deleteDashboard,
  fetchDashboard,
  updateDashboardFavorite,
  updateDashboardPermissions,
} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import {IconCopy, IconDelete, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import EditAccessSelector from 'sentry/views/dashboards/editAccessSelector';
import type {
  DashboardDetails,
  DashboardListItem,
  DashboardPermissions,
} from 'sentry/views/dashboards/types';

import {cloneDashboard} from '../utils';

type Props = {
  api: Client;
  dashboards: DashboardListItem[] | undefined;
  location: Location;
  onDashboardsChange: () => void;
  organization: Organization;
  isLoading?: boolean;
};

enum ResponseKeys {
  NAME = 'title',
  WIDGETS = 'widgetDisplay',
  OWNER = 'createdBy',
  ACCESS = 'permissions',
  CREATED = 'dateCreated',
  FAVORITE = 'isFavorited',
}

const SortKeys = {
  title: {asc: 'title', desc: '-title'},
  dateCreated: {asc: 'dateCreated', desc: '-dateCreated'},
  createdBy: {asc: 'mydashboards', desc: 'mydashboards'},
};

type FavoriteButtonProps = {
  api: Client;
  dashboardId: string;
  isFavorited: boolean;
  onDashboardsChange: () => void;
  organization: Organization;
};

function FavoriteButton({
  isFavorited,
  api,
  organization,
  dashboardId,
  onDashboardsChange,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(isFavorited);
  return (
    <Button
      aria-label={t('Favorite Button')}
      size="zero"
      borderless
      icon={
        <IconStar
          color={favorited ? 'yellow300' : 'gray300'}
          isSolid={favorited}
          aria-label={favorited ? t('UnFavorite') : t('Favorite')}
          size="sm"
        />
      }
      onClick={async () => {
        try {
          setFavorited(!favorited);
          await updateDashboardFavorite(api, organization.slug, dashboardId, !favorited);
          onDashboardsChange();
        } catch (error) {
          // If the api call fails, revert the state
          setFavorited(favorited);
        }
      }}
    />
  );
}

function DashboardTable({
  api,
  organization,
  location,
  dashboards,
  onDashboardsChange,
  isLoading,
}: Props) {
  const columnOrder: GridColumnOrder<ResponseKeys>[] = [
    {key: ResponseKeys.NAME, name: t('Name'), width: COL_WIDTH_UNDEFINED},
    {key: ResponseKeys.WIDGETS, name: t('Widgets'), width: COL_WIDTH_UNDEFINED},
    {key: ResponseKeys.OWNER, name: t('Owner'), width: COL_WIDTH_UNDEFINED},
    {key: ResponseKeys.ACCESS, name: t('Access'), width: COL_WIDTH_UNDEFINED},
    {key: ResponseKeys.CREATED, name: t('Created'), width: COL_WIDTH_UNDEFINED},
  ];

  function handleDelete(dashboard: DashboardListItem) {
    deleteDashboard(api, organization.slug, dashboard.id)
      .then(() => {
        trackAnalytics('dashboards_manage.delete', {
          organization,
          dashboard_id: parseInt(dashboard.id, 10),
          view_type: 'table',
        });
        onDashboardsChange();
        addSuccessMessage(t('Dashboard deleted'));
      })
      .catch(() => {
        addErrorMessage(t('Error deleting Dashboard'));
      });
  }

  async function handleDuplicate(dashboard: DashboardListItem) {
    try {
      const dashboardDetail = await fetchDashboard(api, organization.slug, dashboard.id);
      const newDashboard = cloneDashboard(dashboardDetail);
      newDashboard.widgets.map(widget => (widget.id = undefined));
      await createDashboard(api, organization.slug, newDashboard, true);
      trackAnalytics('dashboards_manage.duplicate', {
        organization,
        dashboard_id: parseInt(dashboard.id, 10),
        view_type: 'table',
      });
      onDashboardsChange();
      addSuccessMessage(t('Dashboard duplicated'));
    } catch (e) {
      addErrorMessage(t('Error duplicating Dashboard'));
    }
  }

  // TODO(__SENTRY_USING_REACT_ROUTER_SIX): We can remove this later, react
  // router 6 handles empty query objects without appending a trailing ?
  const queryLocation = {
    ...(location.query && Object.keys(location.query).length > 0
      ? {query: location.query}
      : {}),
  };

  function renderHeadCell(column: GridColumnOrder<string>) {
    if (column.key in SortKeys) {
      const urlSort = decodeScalar(location.query.sort, 'mydashboards');
      const isCurrentSort =
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        urlSort === SortKeys[column.key].asc || urlSort === SortKeys[column.key].desc;
      const sortDirection =
        !isCurrentSort || column.key === 'createdBy'
          ? undefined
          : urlSort.startsWith('-')
            ? 'desc'
            : 'asc';

      return (
        <SortLink
          align={'left'}
          title={column.name}
          direction={sortDirection}
          canSort
          generateSortLink={() => {
            const newSort = isCurrentSort
              ? sortDirection === 'asc'
                ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  SortKeys[column.key].desc
                : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  SortKeys[column.key].asc
              : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                SortKeys[column.key].asc;
            return {
              ...location,
              query: {...location.query, sort: newSort},
            };
          }}
        />
      );
    }
    return column.name;
  }

  const renderBodyCell = (
    column: GridColumnOrder<string>,
    dataRow: DashboardListItem
  ) => {
    if (column.key === ResponseKeys.FAVORITE) {
      return (
        <FavoriteButton
          isFavorited={dataRow[ResponseKeys.FAVORITE] ?? false}
          api={api}
          organization={organization}
          dashboardId={dataRow.id}
          onDashboardsChange={onDashboardsChange}
          key={dataRow.id}
        />
      );
    }

    if (column.key === ResponseKeys.NAME) {
      return (
        <Link
          to={{
            pathname: `/organizations/${organization.slug}/dashboard/${dataRow.id}/`,
            ...queryLocation,
          }}
        >
          {dataRow[ResponseKeys.NAME]}
        </Link>
      );
    }

    if (column.key === ResponseKeys.WIDGETS) {
      return dataRow[ResponseKeys.WIDGETS].length;
    }

    if (column.key === ResponseKeys.OWNER) {
      return dataRow[ResponseKeys.OWNER] ? (
        <BodyCellContainer>
          <UserAvatar hasTooltip user={dataRow[ResponseKeys.OWNER]} size={26} />
        </BodyCellContainer>
      ) : (
        <ActivityAvatar type="system" size={26} />
      );
    }

    if (column.key === ResponseKeys.ACCESS) {
      /* Handles POST request for Edit Access Selector Changes */
      const onChangeEditAccess = (newDashboardPermissions: DashboardPermissions) => {
        const dashboardCopy = cloneDeep(dataRow);
        dashboardCopy.permissions = newDashboardPermissions;

        updateDashboardPermissions(api, organization.slug, dashboardCopy).then(
          (newDashboard: DashboardDetails) => {
            onDashboardsChange();
            addSuccessMessage(t('Dashboard Edit Access updated.'));
            return newDashboard;
          }
        );
      };

      return (
        <EditAccessSelector
          dashboard={dataRow}
          onChangeEditAccess={onChangeEditAccess}
          listOnly
        />
      );
    }

    if (column.key === ResponseKeys.CREATED) {
      return (
        <BodyCellContainer>
          <DateSelected>
            {dataRow[ResponseKeys.CREATED] ? (
              <DateStatus>
                <TimeSince date={dataRow[ResponseKeys.CREATED]} />
              </DateStatus>
            ) : (
              <DateStatus />
            )}
          </DateSelected>
          <ActionsIconWrapper>
            <StyledButton
              onClick={e => {
                e.stopPropagation();
                openConfirmModal({
                  message: t('Are you sure you want to duplicate this dashboard?'),
                  priority: 'primary',
                  onConfirm: () => handleDuplicate(dataRow),
                });
              }}
              aria-label={t('Duplicate Dashboard')}
              data-test-id={'dashboard-duplicate'}
              icon={<IconCopy />}
              size="sm"
            />
            <StyledButton
              onClick={e => {
                e.stopPropagation();
                openConfirmModal({
                  message: t('Are you sure you want to delete this dashboard?'),
                  priority: 'danger',
                  onConfirm: () => handleDelete(dataRow),
                });
              }}
              aria-label={t('Delete Dashboard')}
              data-test-id={'dashboard-delete'}
              icon={<IconDelete />}
              size="sm"
              disabled={dashboards && dashboards.length <= 1}
            />
          </ActionsIconWrapper>
        </BodyCellContainer>
      );
    }

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return <span>{dataRow[column.key]}</span>;
  };

  return (
    <GridEditable
      data={dashboards ?? []}
      // necessary for edit access dropdown
      bodyStyle={{overflow: 'visible'}}
      columnOrder={columnOrder}
      columnSortBy={[]}
      grid={{
        renderBodyCell,
        renderHeadCell: column => renderHeadCell(column),
        // favorite column
        renderPrependColumns: (isHeader: boolean, dataRow?: any) => {
          if (!organization.features.includes('dashboards-favourite')) {
            return [];
          }
          const favoriteColumn = {
            key: ResponseKeys.FAVORITE,
            name: t('Favorite'),
          };
          if (isHeader) {
            return [
              <StyledIconStar
                color="yellow300"
                isSolid
                aria-label={t('Favorite Column')}
                key="favorite-header"
              />,
            ];
          }
          if (!dataRow) {
            return [];
          }
          return [renderBodyCell(favoriteColumn, dataRow) as any];
        },
        prependColumnWidths: organization.features.includes('dashboards-favourite')
          ? ['max-content']
          : [],
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
  font-size: ${p => p.theme.fontSizeMedium};
  display: grid;
  grid-column-gap: ${space(1)};
  color: ${p => p.theme.textColor};
  ${p => p.theme.overflowEllipsis};
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.textColor};
  padding-left: ${space(1)};
`;

const BodyCellContainer = styled('div')`
  display: flex;
  gap: ${space(4)};
  justify-content: space-between;
  align-items: center;
`;

const ActionsIconWrapper = styled('div')`
  display: flex;
`;

const StyledButton = styled(Button)`
  border: none;
  box-shadow: none;
`;

const StyledIconStar = styled(IconStar)`
  margin-left: ${space(0.25)};
`;
