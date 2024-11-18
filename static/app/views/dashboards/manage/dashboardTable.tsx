import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  createDashboard,
  deleteDashboard,
  fetchDashboard,
} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {Button} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import {IconCopy, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import withApi from 'sentry/utils/withApi';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

import {cloneDashboard} from '../utils';

type Props = {
  api: Client;
  columnCount: number;
  dashboards: DashboardListItem[] | undefined;
  location: Location;
  onDashboardsChange: () => void;
  organization: Organization;
  rowCount: number;
  isLoading?: boolean;
};

enum Keys {
  NAME = 'title',
  WIDGETS = 'widgetDisplay',
  OWNER = 'createdBy',
  CREATED = 'dateCreated',
}

function DashboardTable({
  api,
  organization,
  location,
  dashboards,
  onDashboardsChange,
  isLoading,
}: Props) {
  const columnOrder = [
    {key: Keys.NAME, name: t('Name'), width: COL_WIDTH_UNDEFINED},
    {key: Keys.WIDGETS, name: t('Widgets'), width: COL_WIDTH_UNDEFINED},
    {key: Keys.OWNER, name: t('Owner'), width: COL_WIDTH_UNDEFINED},
    {key: Keys.CREATED, name: t('Created'), width: COL_WIDTH_UNDEFINED},
  ];

  function handleDelete(dashboard: DashboardListItem) {
    deleteDashboard(api, organization.slug, dashboard.id)
      .then(() => {
        trackAnalytics('dashboards_manage.delete', {
          organization,
          dashboard_id: parseInt(dashboard.id, 10),
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

  const renderBodyCell = (
    column: GridColumnOrder<string>,
    dataRow: DashboardListItem
  ) => {
    if (column.key === Keys.NAME) {
      return (
        <Link
          to={{
            pathname: `/organizations/${organization.slug}/dashboard/${dataRow.id}/`,
            ...queryLocation,
          }}
        >
          {dataRow[Keys.NAME]}
        </Link>
      );
    }

    if (column.key === Keys.WIDGETS) {
      return dataRow[Keys.WIDGETS].length;
    }

    if (column.key === Keys.OWNER) {
      return dataRow[Keys.OWNER] ? (
        <ActivityAvatar type="user" user={dataRow[Keys.OWNER]} size={26} />
      ) : (
        <ActivityAvatar type="system" size={26} />
      );
    }

    if (column.key === Keys.CREATED) {
      return (
        <DateActionsContainer>
          <DateSelected>
            {dataRow[Keys.CREATED] ? (
              <DateStatus>
                <TimeSince date={dataRow[Keys.CREATED]} />
              </DateStatus>
            ) : (
              <DateStatus />
            )}
          </DateSelected>
          <ActionsIconWrapper>
            <StyledButton
              onClick={e => {
                e.stopPropagation();
                handleDuplicate(dataRow);
              }}
              aria-label={t('Duplicate Dashboard')}
              icon={<IconCopy />}
              size="sm"
            />
            <StyledButton
              onClick={e => {
                e.stopPropagation();
                handleDelete(dataRow);
              }}
              aria-label={t('Delete Dashboard')}
              icon={<IconDelete />}
              size="sm"
            />
          </ActionsIconWrapper>
        </DateActionsContainer>
      );
    }

    return <span>{dataRow[column.key]}</span>;
  };

  function renderDashboardTable() {
    if (!dashboards?.length && !isLoading) {
      return (
        <EmptyStateWarning>
          <p>{t('Sorry, no Dashboards match your filters.')}</p>
        </EmptyStateWarning>
      );
    }

    return (
      <GridEditable
        data={dashboards ?? []}
        columnOrder={columnOrder}
        columnSortBy={[]}
        grid={{
          renderBodyCell,
        }}
        isLoading={isLoading}
      />
    );
  }

  return <Fragment>{renderDashboardTable()}</Fragment>;
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

const DateActionsContainer = styled('div')`
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
