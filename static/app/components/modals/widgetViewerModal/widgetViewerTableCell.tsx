import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location, LocationDescriptorObject} from 'history';
import trimStart from 'lodash/trimStart';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getIssueFieldRenderer,
  getSortField,
} from 'sentry/utils/dashboards/issueFieldRenderers';
import type {TableDataRow, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  fieldAlignment,
  getAggregateAlias,
  getEquationAliasIndex,
  isAggregateField,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import {formatMRIField, parseField} from 'sentry/utils/metrics/mri';
import {getCustomEventsFieldRenderer} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {ISSUE_FIELDS} from 'sentry/views/dashboards/widgetBuilder/issueWidget/fields';
import {TransactionLink} from 'sentry/views/discover/table/tableView';
import TopResultsIndicator from 'sentry/views/discover/table/topResultsIndicator';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {getTargetForTransactionSummaryLink} from 'sentry/views/discover/utils';

import {WidgetViewerQueryField} from './utils';
// Dashboards only supports top 5 for now
const DEFAULT_NUM_TOP_EVENTS = 5;

type Props = {
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  eventView?: EventView;
  isFirstPage?: boolean;
  isMetricsData?: boolean;
  onHeaderClick?: () => void;
  projects?: Project[];
  tableData?: TableDataWithTitle;
};

export const renderIssueGridHeaderCell = ({
  location,
  widget,
  tableData,
  organization,
  onHeaderClick,
}: Props) =>
  function (
    column: TableColumn<keyof TableDataRow>,
    _columnIndex: number
  ): React.ReactNode {
    const tableMeta = tableData?.meta;
    const align = fieldAlignment(column.name, column.type, tableMeta);
    const sortField = getSortField(String(column.key));

    return (
      <SortLink
        align={align}
        title={<StyledTooltip title={column.name}>{column.name}</StyledTooltip>}
        direction={widget.queries[0]!.orderby === sortField ? 'desc' : undefined}
        canSort={!!sortField}
        generateSortLink={() => ({
          ...location,
          query: {
            ...location.query,
            [WidgetViewerQueryField.SORT]: sortField,
            [WidgetViewerQueryField.PAGE]: undefined,
            [WidgetViewerQueryField.CURSOR]: undefined,
          },
        })}
        onClick={() => {
          onHeaderClick?.();
          trackAnalytics('dashboards_views.widget_viewer.sort', {
            organization,
            widget_type: WidgetType.ISSUE,
            display_type: widget.displayType,
            column: column.name,
            order: 'desc',
          });
        }}
      />
    );
  };

export const renderDiscoverGridHeaderCell = ({
  location,
  selection,
  widget,
  tableData,
  organization,
  onHeaderClick,
  isMetricsData,
}: Props) =>
  function (
    column: TableColumn<keyof TableDataRow>,
    _columnIndex: number
  ): React.ReactNode {
    const {orderby} = widget.queries[0]!;
    // Need to convert orderby to aggregate alias because eventView still uses aggregate alias format
    const aggregateAliasOrderBy = `${
      orderby.startsWith('-') ? '-' : ''
    }${getAggregateAlias(trimStart(orderby, '-'))}`;
    const eventView = eventViewFromWidget(
      widget.title,
      {...widget.queries[0]!, orderby: aggregateAliasOrderBy},
      selection
    );
    const tableMeta = tableData?.meta;
    const align = fieldAlignment(column.name, column.type, tableMeta);
    const field = {field: String(column.key), width: column.width};
    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, tableMeta, undefined, true);
      const queryStringObject = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {
          ...location.query,
          [WidgetViewerQueryField.SORT]: queryStringObject.sort,
          [WidgetViewerQueryField.PAGE]: undefined,
          [WidgetViewerQueryField.CURSOR]: undefined,
        },
      };
    }

    const currentSort = eventView.sortForField(field, tableMeta);
    const canSort =
      !(isMetricsData && field.field === 'title') && isFieldSortable(field, tableMeta);
    const titleText = isEquationAlias(column.name)
      ? eventView.getEquations()[getEquationAliasIndex(column.name)]
      : column.name;

    return (
      <SortLink
        align={align}
        title={<StyledTooltip title={titleText}>{titleText}</StyledTooltip>}
        direction={currentSort ? currentSort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
        onClick={() => {
          onHeaderClick?.();
          trackAnalytics('dashboards_views.widget_viewer.sort', {
            organization,
            widget_type: WidgetType.DISCOVER,
            display_type: widget.displayType,
            column: column.name,
            order: currentSort?.kind === 'desc' ? 'asc' : 'desc',
          });
        }}
      />
    );
  };

export const renderGridBodyCell = ({
  location,
  organization,
  widget,
  tableData,
  isFirstPage,
  projects,
  eventView,
}: Props) =>
  function (
    column: GridColumnOrder,
    dataRow: Record<string, any>,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode {
    const columnKey = String(column.key);
    const isTopEvents = widget.displayType === DisplayType.TOP_N;
    let cell: React.ReactNode;
    switch (widget.widgetType) {
      case WidgetType.ISSUE:
        cell = (
          getIssueFieldRenderer(columnKey) ?? getFieldRenderer(columnKey, ISSUE_FIELDS)
        )(dataRow, {organization, location});
        break;
      case WidgetType.DISCOVER:
      case WidgetType.TRANSACTIONS:
      case WidgetType.ERRORS:
      default:
        if (!tableData || !tableData.meta) {
          return dataRow[column.key];
        }
        const unit = tableData.meta.units?.[column.key];
        cell = getCustomEventsFieldRenderer(columnKey, tableData.meta)(dataRow, {
          organization,
          location,
          eventView,
          unit,
        });

        const fieldName = getAggregateAlias(columnKey);
        const value = dataRow[fieldName];
        if (tableData.meta[fieldName] === 'integer' && defined(value) && value > 999) {
          return (
            <Tooltip
              title={value.toLocaleString()}
              containerDisplayMode="block"
              position="right"
            >
              {cell}
            </Tooltip>
          );
        }
        break;
    }

    if (columnKey === 'transaction' && dataRow.transaction) {
      cell = (
        <TransactionLink
          data-test-id="widget-viewer-transaction-link"
          to={getTargetForTransactionSummaryLink(
            dataRow,
            organization,
            projects,
            eventView
          )}
        >
          {cell}
        </TransactionLink>
      );
    }

    const topResultsCount = tableData
      ? Math.min(tableData?.data.length, DEFAULT_NUM_TOP_EVENTS)
      : DEFAULT_NUM_TOP_EVENTS;
    return (
      <Fragment>
        {isTopEvents &&
        isFirstPage &&
        rowIndex < DEFAULT_NUM_TOP_EVENTS &&
        columnIndex === 0 ? (
          <TopResultsIndicator count={topResultsCount} index={rowIndex} />
        ) : null}
        {cell}
      </Fragment>
    );
  };

export const renderPrependColumns =
  ({location, organization, tableData, eventView}: Props & {eventView: EventView}) =>
  (isHeader: boolean, dataRow?: any, rowIndex?: number): React.ReactNode[] => {
    if (isHeader) {
      return [
        <PrependHeader key="header-event-id">
          <SortLink
            align="left"
            title={t('event id')}
            direction={undefined}
            canSort={false}
            generateSortLink={() => undefined}
          />
        </PrependHeader>,
      ];
    }
    let value = dataRow.id;

    if (tableData?.meta) {
      const fieldRenderer = getFieldRenderer('id', tableData?.meta);
      value = fieldRenderer(dataRow, {organization, location});
    }

    const eventSlug = generateEventSlug(dataRow);

    const target = eventDetailsRouteWithEventView({
      orgSlug: organization.slug,
      eventSlug,
      eventView,
    });

    return [
      <Tooltip key={`eventlink${rowIndex}`} title={t('View Event')}>
        <Link data-test-id="view-event" to={target}>
          {value}
        </Link>
      </Tooltip>,
    ];
  };

export const renderReleaseGridHeaderCell = ({
  location,
  widget,
  tableData,
  organization,
  onHeaderClick,
}: Props) =>
  function (
    column: TableColumn<keyof TableDataRow>,
    _columnIndex: number
  ): React.ReactNode {
    const tableMeta = tableData?.meta;
    const align = fieldAlignment(column.name, column.type, tableMeta);
    const widgetOrderBy = widget.queries[0]!.orderby;
    const sort: Sort = {
      kind: widgetOrderBy.startsWith('-') ? 'desc' : 'asc',
      field: widgetOrderBy.startsWith('-') ? widgetOrderBy.slice(1) : widgetOrderBy,
    };
    const canSort = isAggregateField(column.name);
    const titleText = column.name;

    function generateSortLink(): LocationDescriptorObject {
      const columnSort =
        column.name === sort.field
          ? {...sort, kind: sort.kind === 'desc' ? 'asc' : 'desc'}
          : {kind: 'desc', field: column.name};

      return {
        ...location,
        query: {
          ...location.query,
          [WidgetViewerQueryField.SORT]:
            columnSort.kind === 'desc' ? `-${columnSort.field}` : columnSort.field,
          [WidgetViewerQueryField.PAGE]: undefined,
          [WidgetViewerQueryField.CURSOR]: undefined,
        },
      };
    }

    return (
      <SortLink
        align={align}
        title={<StyledTooltip title={titleText}>{titleText}</StyledTooltip>}
        direction={sort.field === column.name ? sort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
        onClick={() => {
          onHeaderClick?.();
          trackAnalytics('dashboards_views.widget_viewer.sort', {
            organization,
            widget_type: WidgetType.RELEASE,
            display_type: widget.displayType,
            column: column.name,
            order: sort?.kind === 'desc' ? 'asc' : 'desc',
          });
        }}
      />
    );
  };

export const renderMetricGridHeaderCell = () =>
  function (
    column: TableColumn<keyof TableDataRow>,
    _columnIndex: number
  ): React.ReactNode {
    const align = parseField(column.name) ? 'right' : 'left';
    const titleText = formatMRIField(column.name);

    return (
      <StyledTooltip skipWrapper showOnlyOnOverflow title={titleText}>
        <AlignedText align={align}>{titleText}</AlignedText>
      </StyledTooltip>
    );
  };

const StyledTooltip = styled(Tooltip)`
  display: initial;
`;

const PrependHeader = styled('span')`
  color: ${p => p.theme.subText};
`;

const AlignedText = styled('div')<{align: string}>`
  width: 100%;
  text-align: ${p => p.align};
`;
