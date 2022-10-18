import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, Query} from 'history';

import {
  createDashboard,
  deleteDashboard,
  fetchDashboard,
} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Pagination from 'sentry/components/pagination';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalytics from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withApi from 'sentry/utils/withApi';
import {DashboardListItem, DisplayType} from 'sentry/views/dashboardsV2/types';

import {cloneDashboard, miniWidget} from '../utils';

import DashboardCard from './dashboardCard';
import GridPreview from './gridPreview';

type Props = {
  api: Client;
  dashboards: DashboardListItem[] | null;
  location: Location;
  onDashboardsChange: () => void;
  organization: Organization;
  pageLinks: string;
};

function DashboardList({
  api,
  organization,
  location,
  dashboards,
  pageLinks,
  onDashboardsChange,
}: Props) {
  function handleDelete(dashboard: DashboardListItem) {
    deleteDashboard(api, organization.slug, dashboard.id)
      .then(() => {
        trackAdvancedAnalytics('dashboards_manage.delete', {
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
      trackAdvancedAnalytics('dashboards_manage.duplicate', {
        organization,
        dashboard_id: parseInt(dashboard.id, 10),
      });
      onDashboardsChange();
      addSuccessMessage(t('Dashboard duplicated'));
    } catch (e) {
      addErrorMessage(t('Error duplicating Dashboard'));
    }
  }

  function renderDropdownMenu(dashboard: DashboardListItem) {
    const menuItems: MenuItemProps[] = [
      {
        key: 'dashboard-duplicate',
        label: t('Duplicate'),
        onAction: () => handleDuplicate(dashboard),
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
      <DropdownMenuControl
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

  function renderDndPreview(dashboard) {
    return (
      <WidgetGrid>
        {dashboard.widgetDisplay.map((displayType, i) => {
          return displayType === DisplayType.BIG_NUMBER ? (
            <BigNumberWidgetWrapper key={`${i}-${displayType}`}>
              <WidgetImage src={miniWidget(displayType)} />
            </BigNumberWidgetWrapper>
          ) : (
            <MiniWidgetWrapper key={`${i}-${displayType}`}>
              <WidgetImage src={miniWidget(displayType)} />
            </MiniWidgetWrapper>
          );
        })}
      </WidgetGrid>
    );
  }

  function renderGridPreview(dashboard) {
    return <GridPreview widgetPreview={dashboard.widgetPreview} />;
  }

  function renderMiniDashboards() {
    const isUsingGrid = organization.features.includes('dashboard-grid-layout');
    return dashboards?.map((dashboard, index) => {
      const widgetRenderer = isUsingGrid ? renderGridPreview : renderDndPreview;
      const widgetCount = isUsingGrid
        ? dashboard.widgetPreview.length
        : dashboard.widgetDisplay.length;
      return (
        <DashboardCard
          key={`${index}-${dashboard.id}`}
          title={dashboard.title}
          to={{
            pathname: `/organizations/${organization.slug}/dashboard/${dashboard.id}/`,
            query: {...location.query},
          }}
          detail={tn('%s widget', '%s widgets', widgetCount)}
          dateStatus={
            dashboard.dateCreated ? <TimeSince date={dashboard.dateCreated} /> : undefined
          }
          createdBy={dashboard.createdBy}
          renderWidgets={() => widgetRenderer(dashboard)}
          renderContextMenu={() => renderDropdownMenu(dashboard)}
        />
      );
    });
  }

  function renderDashboardGrid() {
    if (!dashboards?.length) {
      return (
        <EmptyStateWarning>
          <p>{t('Sorry, no Dashboards match your filters.')}</p>
        </EmptyStateWarning>
      );
    }
    return <DashboardGrid>{renderMiniDashboards()}</DashboardGrid>;
  }

  return (
    <Fragment>
      {renderDashboardGrid()}
      <PaginationRow
        pageLinks={pageLinks}
        onCursor={(cursor, path, query, direction) => {
          const offset = Number(cursor?.split?.(':')?.[1] ?? 0);

          const newQuery: Query & {cursor?: string} = {...query, cursor};
          const isPrevious = direction === -1;

          if (offset <= 0 && isPrevious) {
            delete newQuery.cursor;
          }
          trackAdvancedAnalytics('dashboards_manage.paginate', {organization});

          browserHistory.push({
            pathname: path,
            query: newQuery,
          });
        }}
      />
    </Fragment>
  );
}

const DashboardGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-template-rows: repeat(3, max-content);
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }
`;

const WidgetGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-flow: row dense;
  gap: ${space(0.25)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.xxlarge}) {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
`;

const BigNumberWidgetWrapper = styled('div')`
  display: flex;
  align-items: flex-start;
  width: 100%;
  height: 100%;

  /* 2 cols */
  grid-area: span 1 / span 2;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    /* 4 cols */
    grid-area: span 1 / span 1;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    /* 6 and 8 cols */
    grid-area: span 1 / span 2;
  }
`;

const MiniWidgetWrapper = styled('div')`
  display: flex;
  align-items: flex-start;
  width: 100%;
  height: 100%;
  grid-area: span 2 / span 2;
`;

const WidgetImage = styled('img')`
  width: 100%;
  height: 100%;
`;

const PaginationRow = styled(Pagination)`
  margin-bottom: ${space(3)};
`;

const DropdownTrigger = styled(Button)`
  transform: translateX(${space(1)});
`;

export default withApi(DashboardList);
