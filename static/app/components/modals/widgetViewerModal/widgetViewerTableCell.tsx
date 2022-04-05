import * as React from 'react';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';

import {GridColumnOrder} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {Organization, PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  getIssueFieldRenderer,
  getSortField,
} from 'sentry/utils/dashboards/issueFieldRenderers';
import {TableDataRow, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import EventView, {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  fieldAlignment,
  getAggregateAlias,
  getEquationAliasIndex,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import {eventViewFromWidget} from 'sentry/views/dashboardsV2/utils';
import {ISSUE_FIELDS} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/fields';
import TopResultsIndicator from 'sentry/views/eventsV2/table/topResultsIndicator';
import {TableColumn} from 'sentry/views/eventsV2/table/types';

import {WidgetViewerQueryField} from './utils';
// Dashboards only supports top 5 for now
const DEFAULT_NUM_TOP_EVENTS = 5;

type Props = {
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  isFirstPage?: boolean;
  tableData?: TableDataWithTitle;
};

export const renderIssueGridHeaderCell =
  ({location, widget, tableData, organization}: Props) =>
  (column: TableColumn<keyof TableDataRow>, _columnIndex: number): React.ReactNode => {
    const tableMeta = tableData?.meta;
    const align = fieldAlignment(column.name, column.type, tableMeta);
    const sortField = getSortField(String(column.key));

    return (
      <SortLink
        align={align}
        title={<StyledTooltip title={column.name}>{column.name}</StyledTooltip>}
        direction={widget.queries[0].orderby === sortField ? 'desc' : undefined}
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
          trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.sort', {
            organization,
            widget_type: widget.widgetType ?? WidgetType.DISCOVER,
            display_type: widget.displayType,
            column: column.name,
            order: 'desc',
          });
        }}
      />
    );
  };

export const renderDiscoverGridHeaderCell =
  ({location, selection, widget, tableData, organization}: Props) =>
  (column: TableColumn<keyof TableDataRow>, _columnIndex: number): React.ReactNode => {
    const eventView = eventViewFromWidget(
      widget.title,
      widget.queries[0],
      selection,
      widget.displayType
    );
    const tableMeta = tableData?.meta;
    const align = fieldAlignment(column.name, column.type, tableMeta);
    const field = {field: String(column.key), width: column.width};
    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, tableMeta);
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
    const canSort = isFieldSortable(field, tableMeta);
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
          trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.sort', {
            organization,
            widget_type: widget.widgetType ?? WidgetType.DISCOVER,
            display_type: widget.displayType,
            column: column.name,
            order: currentSort?.kind === 'desc' ? 'asc' : 'desc',
          });
        }}
      />
    );
  };

export const renderGridBodyCell =
  ({location, organization, widget, tableData, isFirstPage}: Props) =>
  (
    column: GridColumnOrder,
    dataRow: Record<string, any>,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode => {
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
      default:
        if (!tableData || !tableData.meta) {
          return dataRow[column.key];
        }
        cell = getFieldRenderer(columnKey, tableData.meta)(dataRow, {
          organization,
          location,
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

    return (
      <React.Fragment>
        {isTopEvents &&
        isFirstPage &&
        rowIndex < DEFAULT_NUM_TOP_EVENTS &&
        columnIndex === 0 ? (
          <TopResultsIndicator count={DEFAULT_NUM_TOP_EVENTS} index={rowIndex} />
        ) : null}
        {cell}
      </React.Fragment>
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

const StyledTooltip = styled(Tooltip)`
  display: initial;
`;

const PrependHeader = styled('span')`
  color: ${p => p.theme.subText};
`;
