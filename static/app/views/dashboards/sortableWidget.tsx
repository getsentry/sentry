import {useEffect, useRef, useState, type ComponentProps} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {LazyRender} from 'sentry/components/lazyRender';
import PanelAlert from 'sentry/components/panels/panelAlert';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import type {Sort} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {useWidgetSlideout} from 'sentry/views/dashboards/utils/useWidgetSlideout';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';

import {checkUserHasEditAccess} from './utils/checkUserHasEditAccess';
import {DashboardsMEPProvider} from './widgetCard/dashboardsMEPContext';
import {Toolbar} from './widgetCard/toolbar';
import {
  WidgetType,
  type DashboardFilters,
  type DashboardPermissions,
  type Widget,
  type WidgetQuery,
} from './types';
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
  isEmbedded?: boolean;
  isMobile?: boolean;
  isPrebuiltDashboard?: boolean;
  isPreview?: boolean;
  newlyAddedWidget?: Widget;
  onNewWidgetScrollComplete?: () => void;
  useTimeseriesVisualization?: boolean;
  windowWidth?: number;
};

function SortableWidget(props: Props) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [tableWidths, setTableWidths] = useState<number[]>(
    props.widget.tableWidths ?? []
  );
  const [queries, setQueries] = useState<WidgetQuery[]>();
  const {
    widget,
    isEditingDashboard,
    widgetLimitReached,
    onDelete,
    onEdit,
    onDuplicate,
    onSetTransactionsDataset,
    isEmbedded,
    isPreview,
    isMobile,
    windowWidth,
    index,
    dashboardFilters,
    widgetLegendState,
    dashboardPermissions,
    dashboardCreator,
    newlyAddedWidget,
    onNewWidgetScrollComplete,
    useTimeseriesVisualization,
    isPrebuiltDashboard = false,
  } = props;

  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const hasEditAccess =
    checkUserHasEditAccess(
      currentUser,
      userTeams,
      organization,
      dashboardPermissions,
      dashboardCreator
    ) && !isPrebuiltDashboard;

  const {hasSlideout, onWidgetClick} = useWidgetSlideout(widget);

  const disableTransactionWidget =
    organization.features.includes('discover-saved-queries-deprecation') &&
    widget.widgetType === WidgetType.TRANSACTIONS;

  useEffect(() => {
    const isMatchingWidget = isEditingDashboard
      ? widget.tempId === newlyAddedWidget?.tempId
      : widget.id === newlyAddedWidget?.id;
    if (widgetRef.current && newlyAddedWidget && isMatchingWidget) {
      widgetRef.current.scrollIntoView({behavior: 'smooth', block: 'center'});
      onNewWidgetScrollComplete?.();
    }
  }, [newlyAddedWidget, widget, isEditingDashboard, onNewWidgetScrollComplete]);

  const onWidgetTableSort = (sort: Sort) => {
    const newOrderBy = `${sort.kind === 'desc' ? '-' : ''}${sort.field}`;
    // Override the widget queries to pass the temporary sort to the widget and expanded modal
    const widgetQueries = cloneDeep(widget.queries);
    if (widgetQueries[0]) widgetQueries[0].orderby = newOrderBy;
    setQueries(widgetQueries);
  };

  const onWidgetTableResizeColumn = (columns: TabularColumn[]) => {
    const widths = columns.map(column => column.width as number);
    setTableWidths(widths);
  };

  const widgetProps: ComponentProps<typeof WidgetCard> = {
    widget: {...widget, queries: queries ?? widget.queries, tableWidths},
    isEditingDashboard,
    widgetLimitReached,
    hasEditAccess,
    onDelete,
    onEdit,
    onDuplicate,
    onSetTransactionsDataset,
    showContextMenu: !isEmbedded || isPrebuiltDashboard,
    isPreview,
    index,
    dashboardFilters,
    widgetLegendState,
    renderErrorMessage: errorMessage => {
      return (
        typeof errorMessage === 'string' && (
          <PanelAlert variant="danger">{errorMessage}</PanelAlert>
        )
      );
    },
    isMobile,
    windowWidth,
    tableItemLimit: TABLE_ITEM_LIMIT,
    onWidgetTableSort,
    onWidgetTableResizeColumn,
    useTimeseriesVisualization,
  };

  return (
    <GridWidgetWrapper ref={widgetRef} onClick={onWidgetClick} isClickable={hasSlideout}>
      <DashboardsMEPProvider>
        <LazyRender containerHeight={200} withoutContainer>
          <WidgetCard {...widgetProps} />
          {props.isEditingDashboard && (
            <Toolbar
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              onDuplicate={props.onDuplicate}
              isMobile={props.isMobile}
              disableEdit={disableTransactionWidget}
              disableDuplicate={disableTransactionWidget}
              disabledReason={t(
                'You may have limited functionality due to the ongoing migration of transactions to spans.'
              )}
            />
          )}
        </LazyRender>
      </DashboardsMEPProvider>
    </GridWidgetWrapper>
  );
}

export default SortableWidget;

const GridWidgetWrapper = styled('div')<{isClickable: boolean}>`
  height: 100%;
  cursor: ${p => (p.isClickable ? 'pointer' : 'default')};
`;
