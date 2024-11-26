import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {LazyRender} from 'sentry/components/lazyRender';
import PanelAlert from 'sentry/components/panels/panelAlert';
import type {User} from 'sentry/types/user';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/detail';
import WidgetCard from 'sentry/views/dashboards/widgetCard';

import {DashboardsMEPProvider} from './widgetCard/dashboardsMEPContext';
import {Toolbar} from './widgetCard/toolbar';
import type {DashboardFilters, DashboardPermissions, Widget} from './types';
import type WidgetLegendSelectionState from './widgetLegendSelectionState';

const TABLE_ITEM_LIMIT = 20;

type Props = {
  index: string;
  isEditingDashboard: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onSetTransactionsDataset: () => void;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  widgetLimitReached: boolean;
  dashboardCreator?: User;
  dashboardFilters?: DashboardFilters;
  dashboardPermissions?: DashboardPermissions;
  isMobile?: boolean;
  isPreview?: boolean;
  windowWidth?: number;
};

function SortableWidget(props: Props) {
  const {
    widget,
    isEditingDashboard,
    widgetLimitReached,
    onDelete,
    onEdit,
    onDuplicate,
    onSetTransactionsDataset,
    isPreview,
    isMobile,
    windowWidth,
    index,
    dashboardFilters,
    widgetLegendState,
    dashboardPermissions,
    dashboardCreator,
  } = props;

  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  let hasEditAccess = true;
  if (organization.features.includes('dashboards-edit-access')) {
    hasEditAccess = checkUserHasEditAccess(
      currentUser,
      userTeams,
      organization,
      dashboardPermissions,
      dashboardCreator
    );
  }

  const widgetProps: ComponentProps<typeof WidgetCard> = {
    widget,
    isEditingDashboard,
    widgetLimitReached,
    hasEditAccess,
    onDelete,
    onEdit,
    onDuplicate,
    onSetTransactionsDataset,
    showContextMenu: true,
    isPreview,
    index,
    dashboardFilters,
    widgetLegendState,
    renderErrorMessage: errorMessage => {
      return (
        typeof errorMessage === 'string' && (
          <PanelAlert type="error">{errorMessage}</PanelAlert>
        )
      );
    },
    isMobile,
    windowWidth,
    tableItemLimit: TABLE_ITEM_LIMIT,
  };

  return (
    <GridWidgetWrapper>
      <DashboardsMEPProvider>
        <LazyRender containerHeight={200} withoutContainer>
          <WidgetCard {...widgetProps} />
          {props.isEditingDashboard && (
            <Toolbar
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              onDuplicate={props.onDuplicate}
              isMobile={props.isMobile}
            />
          )}
        </LazyRender>
      </DashboardsMEPProvider>
    </GridWidgetWrapper>
  );
}

export default SortableWidget;

const GridWidgetWrapper = styled('div')`
  height: 100%;
`;
