import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {
  createDashboard,
  deleteDashboard,
  fetchDashboard,
  updateDashboardFavorite,
} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import withApi from 'sentry/utils/withApi';
import {
  DASHBOARD_CARD_GRID_PADDING,
  MINIMUM_DASHBOARD_CARD_WIDTH,
} from 'sentry/views/dashboards/manage/settings';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

import {cloneDashboard} from '../utils';

import DashboardCard from './dashboardCard';
import GridPreview from './gridPreview';

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

function DashboardGrid({
  api,
  organization,
  location,
  dashboards,
  onDashboardsChange,
  rowCount,
  columnCount,
  isLoading,
}: Props) {
  // this acts as a cache for the dashboards being passed in. It preserves the previously populated dashboard list
  // to be able to show the 'previous' dashboards on resize
  const [currentDashboards, setCurrentDashboards] = useState<
    DashboardListItem[] | undefined
  >(dashboards);

  useEffect(() => {
    if (dashboards?.length) {
      setCurrentDashboards(dashboards);
    }
  }, [dashboards]);

  function handleDelete(dashboard: DashboardListItem) {
    deleteDashboard(api, organization.slug, dashboard.id)
      .then(() => {
        trackAnalytics('dashboards_manage.delete', {
          organization,
          dashboard_id: parseInt(dashboard.id, 10),
          view_type: 'grid',
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
        view_type: 'grid',
      });
      onDashboardsChange();
      addSuccessMessage(t('Dashboard duplicated'));
    } catch (e) {
      addErrorMessage(t('Error duplicating Dashboard'));
    }
  }

  async function handleFavorite(dashboard: DashboardListItem, isFavorited: boolean) {
    try {
      await updateDashboardFavorite(api, organization.slug, dashboard.id, isFavorited);
      onDashboardsChange();
      trackAnalytics('dashboards_manage.toggle_favorite', {
        organization,
        dashboard_id: dashboard.id,
        favorited: isFavorited,
      });
    } catch (error) {
      throw error;
    }
  }

  function renderDropdownMenu(dashboard: DashboardListItem) {
    const menuItems: MenuItemProps[] = [
      {
        key: 'dashboard-duplicate',
        label: t('Duplicate'),
        onAction: () => {
          openConfirmModal({
            message: t('Are you sure you want to duplicate this dashboard?'),
            priority: 'primary',
            onConfirm: () => handleDuplicate(dashboard),
          });
        },
      },
      {
        key: 'dashboard-delete',
        label: t('Delete'),
        priority: 'danger',
        onAction: () => {
          openConfirmModal({
            message: t('Are you sure you want to delete this dashboard?'),
            priority: 'danger',
            onConfirm: () => handleDelete(dashboard),
          });
        },
      },
    ];

    return (
      <DropdownMenu
        items={menuItems}
        trigger={triggerProps => (
          <DropdownTrigger
            {...triggerProps}
            aria-label={t('Dashboard actions')}
            size="xs"
            borderless
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();

              triggerProps.onClick?.(e);
            }}
            icon={<IconEllipsis direction="down" size="sm" />}
          />
        )}
        position="bottom-end"
        disabledKeys={dashboards && dashboards.length <= 1 ? ['dashboard-delete'] : []}
        offset={4}
      />
    );
  }
  function renderGridPreview(dashboard: any) {
    return <GridPreview widgetPreview={dashboard.widgetPreview} />;
  }

  // TODO(__SENTRY_USING_REACT_ROUTER_SIX): We can remove this later, react
  // router 6 handles empty query objects without appending a trailing ?
  const queryLocation = {
    ...(location.query && Object.keys(location.query).length > 0
      ? {query: location.query}
      : {}),
  };

  function renderMiniDashboards() {
    // on pagination, render no dashboards to show placeholders while loading
    if (
      rowCount * columnCount === currentDashboards?.length &&
      !isEqual(currentDashboards, dashboards)
    ) {
      return [];
    }

    return currentDashboards?.slice(0, rowCount * columnCount).map((dashboard, index) => {
      return (
        <DashboardCard
          key={`${index}-${dashboard.id}`}
          title={dashboard.title}
          to={{
            pathname: `/organizations/${organization.slug}/dashboard/${dashboard.id}/`,
            ...queryLocation,
          }}
          detail={tn('%s widget', '%s widgets', dashboard.widgetPreview.length)}
          dateStatus={
            dashboard.dateCreated ? <TimeSince date={dashboard.dateCreated} /> : undefined
          }
          createdBy={dashboard.createdBy}
          renderWidgets={() => renderGridPreview(dashboard)}
          renderContextMenu={() => renderDropdownMenu(dashboard)}
          isFavorited={dashboard.isFavorited}
          onFavorite={isFavorited => handleFavorite(dashboard, isFavorited)}
        />
      );
    });
  }

  function renderDashboardGrid() {
    if (!dashboards?.length && !isLoading) {
      return (
        <EmptyStateWarning>
          <p>{t('Sorry, no Dashboards match your filters.')}</p>
        </EmptyStateWarning>
      );
    }

    const gridIsBeingResized = rowCount * columnCount !== currentDashboards?.length;

    // finds number of dashboards (cached or not) based on if the screen is being resized or not
    const numDashboards = gridIsBeingResized
      ? currentDashboards?.length ?? 0
      : dashboards?.length ?? 0;

    return (
      <DashboardGridContainer
        rows={rowCount}
        columns={columnCount}
        data-test-id={'dashboard-grid'}
      >
        {renderMiniDashboards()}
        {isLoading &&
          rowCount * columnCount > numDashboards &&
          new Array(rowCount * columnCount - numDashboards)
            .fill(0)
            .map((_, index) => <Placeholder key={index} height="210px" />)}
      </DashboardGridContainer>
    );
  }

  return <Fragment>{renderDashboardGrid()}</Fragment>;
}

const DashboardGridContainer = styled('div')<{columns: number; rows: number}>`
  display: grid;
  grid-template-columns: repeat(
    ${props => props.columns},
    minmax(${MINIMUM_DASHBOARD_CARD_WIDTH}px, 1fr)
  );
  grid-template-rows: repeat(${props => props.rows}, max-content);
  gap: ${DASHBOARD_CARD_GRID_PADDING}px;
`;

const DropdownTrigger = styled(Button)`
  transform: translateX(${space(1)});
`;

export default withApi(DashboardGrid);
