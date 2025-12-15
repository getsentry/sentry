import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {updateDashboardFavorite} from 'sentry/actionCreators/dashboards';
import type {Client} from 'sentry/api';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useQueryClient} from 'sentry/utils/queryClient';
import withApi from 'sentry/utils/withApi';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {useDeleteDashboard} from 'sentry/views/dashboards/hooks/useDeleteDashboard';
import {useDuplicateDashboard} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import {
  DASHBOARD_CARD_GRID_PADDING,
  MINIMUM_DASHBOARD_CARD_WIDTH,
} from 'sentry/views/dashboards/manage/settings';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

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
  const queryClient = useQueryClient();
  const handleDuplicateDashboard = useDuplicateDashboard({
    onSuccess: onDashboardsChange,
  });
  const handleDeleteDashboard = useDeleteDashboard({
    onSuccess: onDashboardsChange,
  });
  // this acts as a cache for the dashboards being passed in. It preserves the previously populated dashboard list
  // to be able to show the 'previous' dashboards on resize
  const [currentDashboards, setCurrentDashboards] = useState<
    DashboardListItem[] | undefined
  >(dashboards);

  useEffect(() => {
    if (dashboards?.length) {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setCurrentDashboards(dashboards);
    }
  }, [dashboards]);

  async function handleFavorite(dashboard: DashboardListItem, isFavorited: boolean) {
    await updateDashboardFavorite(
      api,
      queryClient,
      organization,
      dashboard.id,
      isFavorited
    );
    onDashboardsChange();
    trackAnalytics('dashboards_manage.toggle_favorite', {
      organization,
      dashboard_id: dashboard.id,
      favorited: isFavorited,
    });
  }

  function renderDropdownMenu(dashboard: DashboardListItem, dashboardLimitData: any) {
    const {
      hasReachedDashboardLimit,
      isLoading: isLoadingDashboardsLimit,
      limitMessage,
    } = dashboardLimitData;
    const menuItems: MenuItemProps[] = [
      {
        key: 'dashboard-duplicate',
        label: t('Duplicate'),
        onAction: () => {
          openConfirmModal({
            message: t('Are you sure you want to duplicate this dashboard?'),
            priority: 'primary',
            onConfirm: () => handleDuplicateDashboard(dashboard, 'grid'),
          });
        },
        disabled:
          hasReachedDashboardLimit ||
          isLoadingDashboardsLimit ||
          (defined(dashboard.prebuiltId) &&
            !organization.features.includes('dashboards-prebuilt-controls')),
        tooltip:
          defined(dashboard.prebuiltId) &&
          !organization.features.includes('dashboards-prebuilt-controls')
            ? t('Prebuilt dashboards cannot be duplicated')
            : limitMessage,
        tooltipOptions: {
          isHoverable: true,
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
            onConfirm: () => handleDeleteDashboard(dashboard, 'grid'),
          });
        },
        disabled: defined(dashboard.prebuiltId),
        tooltip: defined(dashboard.prebuiltId)
          ? t('Prebuilt dashboards cannot be deleted')
          : undefined,
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
        <DashboardCreateLimitWrapper key={`${index}-${dashboard.id}`}>
          {dashboardLimitData => (
            <DashboardCard
              title={dashboard.title}
              to={{
                pathname: `/organizations/${organization.slug}/dashboard/${dashboard.id}/`,
                ...queryLocation,
              }}
              detail={tn('%s widget', '%s widgets', dashboard.widgetPreview.length)}
              dateStatus={
                dashboard.dateCreated ? (
                  <TimeSince date={dashboard.dateCreated} />
                ) : undefined
              }
              createdBy={dashboard.createdBy}
              renderWidgets={() => renderGridPreview(dashboard)}
              renderContextMenu={() => renderDropdownMenu(dashboard, dashboardLimitData)}
              isFavorited={dashboard.isFavorited}
              onFavorite={isFavorited => handleFavorite(dashboard, isFavorited)}
            />
          )}
        </DashboardCreateLimitWrapper>
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
      ? (currentDashboards?.length ?? 0)
      : (dashboards?.length ?? 0);

    return (
      <DashboardGridContainer
        rows={rowCount}
        columns={columnCount}
        data-test-id="dashboard-grid"
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
