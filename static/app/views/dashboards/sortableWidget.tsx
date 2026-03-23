import {useCallback, useEffect, useRef, useState, type ComponentProps} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {LazyRender} from 'sentry/components/lazyRender';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {
  GRID_BODY_ROW_HEIGHT,
  GRID_HEAD_ROW_HEIGHT,
} from 'sentry/components/tables/gridEditable/styles';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {NUM_DESKTOP_COLS} from 'sentry/views/dashboards/constants';
import {isWidgetEditable} from 'sentry/views/dashboards/utils';
import {useWidgetSlideout} from 'sentry/views/dashboards/utils/useWidgetSlideout';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import type {OnDataFetchedParams} from 'sentry/views/dashboards/widgetCard';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {HEADER_HEIGHT} from 'sentry/views/dashboards/widgets/widget/widget';

import {useWidgetErrorCallback} from './contexts/widgetErrorContext';
import {checkUserHasEditAccess} from './utils/checkUserHasEditAccess';
import {DashboardsMEPProvider} from './widgetCard/dashboardsMEPContext';
import {Toolbar} from './widgetCard/toolbar';
import {
  DisplayType,
  WidgetType,
  type DashboardFilters,
  type DashboardPermissions,
  type Widget,
  type WidgetQuery,
} from './types';
import type WidgetLegendSelectionState from './widgetLegendSelectionState';

const TABLE_ITEM_LIMIT = 20;

// Widget frame header (title bar): 26px + 12px padding (theme.space.lg)
const WIDGET_HEADER_HEIGHT = HEADER_HEIGHT + 12;
// Widget frame padding (top visualization padding + bottom padding + border)
const WIDGET_FRAME_PADDING = 20;

/**
 * Calculates the pixel height needed for a table widget based on its row count.
 */
function calculateTableContentHeight(rowCount: number): number {
  return (
    WIDGET_HEADER_HEIGHT +
    GRID_HEAD_ROW_HEIGHT +
    rowCount * GRID_BODY_ROW_HEIGHT +
    WIDGET_FRAME_PADDING
  );
}

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
  onContentHeight?: (widgetKey: string, height: number) => void;
  onNewWidgetScrollComplete?: () => void;
  widgetInterval?: string;
  windowWidth?: number;
};

export function SortableWidget(props: Props) {
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
    isPrebuiltDashboard = false,
  } = props;

  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const onWidgetError = useWidgetErrorCallback();
  const hasEditAccess =
    checkUserHasEditAccess(
      currentUser,
      userTeams,
      organization,
      dashboardPermissions,
      dashboardCreator
    ) && !isPrebuiltDashboard;

  const {hasSlideout, onWidgetClick} = useWidgetSlideout(widget, dashboardFilters);

  const disableTransactionWidget =
    organization.features.includes('discover-saved-queries-deprecation') &&
    widget.widgetType === WidgetType.TRANSACTIONS;

  const disableEdit = !isWidgetEditable(widget.displayType);

  const isAutoHeight =
    widget.heightMode === 'auto' &&
    widget.displayType === DisplayType.TABLE &&
    widget.layout?.w === NUM_DESKTOP_COLS;

  const {onContentHeight} = props;
  const handleDataFetched = useCallback(
    (data: OnDataFetchedParams) => {
      if (!isAutoHeight || !onContentHeight) {
        return;
      }

      const rowCount = data.tableResults?.[0]?.data?.length;
      if (defined(rowCount)) {
        onContentHeight(index, calculateTableContentHeight(rowCount));
      }
    },
    [isAutoHeight, index, onContentHeight]
  );

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
      if (
        typeof errorMessage === 'string' &&
        errorMessage !== t('No data found') &&
        onWidgetError
      ) {
        onWidgetError(widget, errorMessage);
      }
      return (
        typeof errorMessage === 'string' && (
          <PanelAlert variant="danger">{errorMessage}</PanelAlert>
        )
      );
    },
    isMobile,
    windowWidth,
    tableItemLimit:
      widget.displayType === DisplayType.TABLE
        ? TABLE_ITEM_LIMIT
        : (widget.limit ?? TABLE_ITEM_LIMIT),
    onWidgetTableSort,
    onWidgetTableResizeColumn,
    onDataFetched: isAutoHeight ? handleDataFetched : undefined,
    widgetInterval: props.widgetInterval,
  };

  return (
    <GridWidgetWrapper
      ref={widgetRef}
      onClick={onWidgetClick}
      isClickable={hasSlideout}
      data-test-id="sortable-widget"
    >
      <DashboardsMEPProvider>
        <LazyRender containerHeight={200} withoutContainer>
          <WidgetCard {...widgetProps} />
          {props.isEditingDashboard && (
            <Toolbar
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              onDuplicate={props.onDuplicate}
              isMobile={props.isMobile}
              disableEdit={disableTransactionWidget || disableEdit}
              disableDuplicate={disableTransactionWidget}
              disabledReason={
                disableEdit
                  ? t('Static widgets from the widget library cannot be edited.')
                  : t(
                      'You may have limited functionality due to the ongoing migration of transactions to spans.'
                    )
              }
            />
          )}
        </LazyRender>
      </DashboardsMEPProvider>
    </GridWidgetWrapper>
  );
}

const GridWidgetWrapper = styled('div')<{isClickable: boolean}>`
  height: 100%;
  cursor: ${p => (p.isClickable ? 'pointer' : 'default')};
`;
