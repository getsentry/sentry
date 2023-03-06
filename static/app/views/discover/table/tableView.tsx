import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location, LocationDescriptorObject} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import GridEditable, {
  COL_WIDTH_MINIMUM,
  COL_WIDTH_UNDEFINED,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import ReplayIdCountProvider from 'sentry/components/replays/replayIdCountProvider';
import {Tooltip} from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {
  isFieldSortable,
  pickRelevantLocationQueryStrings,
} from 'sentry/utils/discover/eventView';
import {
  DURATION_UNITS,
  getFieldRenderer,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import {
  Column,
  fieldAlignment,
  getEquationAliasIndex,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import {DisplayModes, TOP_N} from 'sentry/utils/discover/types';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import ViewReplayLink from 'sentry/utils/discover/viewReplayLink';
import {getShortEventId} from 'sentry/utils/events';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {
  generateReplayLink,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';

import {getExpandedResults, pushEventViewToLocation} from '../utils';

import {QuickContextHoverWrapper} from './quickContext/quickContextWrapper';
import {ContextType} from './quickContext/utils';
import CellAction, {Actions, updateQuery} from './cellAction';
import ColumnEditModal, {modalCss} from './columnEditModal';
import TableActions from './tableActions';
import TopResultsIndicator from './topResultsIndicator';
import {TableColumn} from './types';

export type TableViewProps = {
  error: string | null;
  eventView: EventView;
  isFirstPage: boolean;

  isLoading: boolean;
  location: Location;

  measurementKeys: null | string[];
  onChangeShowTags: () => void;
  organization: Organization;
  showTags: boolean;
  tableData: TableData | null | undefined;

  title: string;
  customMeasurements?: CustomMeasurementCollection;
  isHomepage?: boolean;
  spanOperationBreakdownKeys?: string[];
};

/**
 * The `TableView` is marked with leading _ in its method names. It consumes
 * the EventView object given in its props to generate new EventView objects
 * for actions like resizing column.

 * The entire state of the table view (or event view) is co-located within
 * the EventView object. This object is fed from the props.
 *
 * Attempting to modify the state, and therefore, modifying the given EventView
 * object given from its props, will generate new instances of EventView objects.
 *
 * In most cases, the new EventView object differs from the previous EventView
 * object. The new EventView object is pushed to the location object.
 */
function TableView(props: TableViewProps) {
  const {projects} = useProjects();
  const routes = useRoutes();
  const replayLinkGenerator = generateReplayLink(routes);

  /**
   * Updates a column on resizing
   */
  function _resizeColumn(
    columnIndex: number,
    nextColumn: TableColumn<keyof TableDataRow>
  ) {
    const {location, eventView} = props;

    const newWidth = nextColumn.width ? Number(nextColumn.width) : COL_WIDTH_UNDEFINED;
    const nextEventView = eventView.withResizedColumn(columnIndex, newWidth);

    pushEventViewToLocation({
      location,
      nextEventView,
      extraQuery: pickRelevantLocationQueryStrings(location),
    });
  }

  function _renderPrependColumns(
    isHeader: boolean,
    dataRow?: any,
    rowIndex?: number
  ): React.ReactNode[] {
    const {organization, eventView, tableData, location, isHomepage} = props;
    const hasAggregates = eventView.hasAggregateField();
    const hasIdField = eventView.hasIdField();

    if (isHeader) {
      if (hasAggregates) {
        return [
          <PrependHeader key="header-icon">
            <IconStack size="sm" />
          </PrependHeader>,
        ];
      }
      if (!hasIdField) {
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
      return [];
    }

    if (hasAggregates) {
      const nextView = getExpandedResults(eventView, {}, dataRow);

      const target = {
        pathname: location.pathname,
        query: nextView.generateQueryStringObject(),
      };

      return [
        <Tooltip key={`eventlink${rowIndex}`} title={t('Open Group')}>
          <Link
            to={target}
            data-test-id="open-group"
            onClick={() => {
              if (nextView.isEqualTo(eventView)) {
                Sentry.captureException(new Error('Failed to drilldown'));
              }
            }}
          >
            <StyledIcon size="sm" />
          </Link>
        </Tooltip>,
      ];
    }
    if (!hasIdField) {
      let value = dataRow.id;

      if (tableData && tableData.meta) {
        const fieldRenderer = getFieldRenderer('id', tableData.meta);
        value = fieldRenderer(dataRow, {organization, location});
      }

      const eventSlug = generateEventSlug(dataRow);

      const target = eventDetailsRouteWithEventView({
        orgSlug: organization.slug,
        eventSlug,
        eventView,
        isHomepage,
      });

      const eventIdLink = (
        <StyledLink data-test-id="view-event" to={target}>
          {value}
        </StyledLink>
      );

      return [
        <QuickContextHoverWrapper
          key={`quickContextEventHover${rowIndex}`}
          dataRow={dataRow}
          contextType={ContextType.EVENT}
          organization={organization}
          projects={projects}
          eventView={eventView}
        >
          {eventIdLink}
        </QuickContextHoverWrapper>,
      ];
    }
    return [];
  }

  function _renderGridHeaderCell(
    column: TableColumn<keyof TableDataRow>
  ): React.ReactNode {
    const {eventView, location, tableData} = props;
    const tableMeta = tableData?.meta;

    const align = fieldAlignment(column.name, column.type, tableMeta);
    const field = {field: column.key as string, width: column.width};
    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, tableMeta);
      const queryStringObject = nextEventView.generateQueryStringObject();
      // Need to pull yAxis from location since eventView only stores 1 yAxis field at time
      queryStringObject.yAxis = decodeList(location.query.yAxis);

      return {
        ...location,
        query: queryStringObject,
      };
    }
    const currentSort = eventView.sortForField(field, tableMeta);
    const canSort = isFieldSortable(field, tableMeta);
    let titleText = isEquationAlias(column.name)
      ? eventView.getEquations()[getEquationAliasIndex(column.name)]
      : column.name;

    if (column.name.toLowerCase() === 'replayid') {
      titleText = 'Replay';
    }

    const title = (
      <StyledTooltip title={titleText}>
        <Truncate value={titleText} maxLength={60} expandable={false} />
      </StyledTooltip>
    );

    return (
      <SortLink
        align={align}
        title={title}
        direction={currentSort ? currentSort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
  }

  function _renderGridBodyCell(
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow,
    rowIndex: number,
    columnIndex: number
  ): React.ReactNode {
    const {isFirstPage, eventView, location, organization, tableData, isHomepage} = props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }

    const columnKey = String(column.key);
    const fieldRenderer = getFieldRenderer(columnKey, tableData.meta, false);

    const display = eventView.getDisplayMode();
    const isTopEvents =
      display === DisplayModes.TOP5 || display === DisplayModes.DAILYTOP5;

    const topEvents = eventView.topEvents ? parseInt(eventView.topEvents, 10) : TOP_N;
    const count = Math.min(tableData?.data?.length ?? topEvents, topEvents);

    const unit = tableData.meta.units?.[columnKey];
    let cell = fieldRenderer(dataRow, {organization, location, unit});

    if (columnKey === 'id') {
      const eventSlug = generateEventSlug(dataRow);

      const target = eventDetailsRouteWithEventView({
        orgSlug: organization.slug,
        eventSlug,
        eventView,
        isHomepage,
      });

      const idLink = (
        <StyledLink data-test-id="view-event" to={target}>
          {cell}
        </StyledLink>
      );

      cell = (
        <QuickContextHoverWrapper
          organization={organization}
          dataRow={dataRow}
          contextType={ContextType.EVENT}
          projects={projects}
          eventView={eventView}
        >
          {idLink}
        </QuickContextHoverWrapper>
      );
    } else if (columnKey === 'trace') {
      const dateSelection = eventView.normalizeDateSelection(location);
      if (dataRow.trace) {
        const target = getTraceDetailsUrl(
          organization,
          String(dataRow.trace),
          dateSelection,
          {}
        );

        cell = (
          <Tooltip title={t('View Trace')}>
            <StyledLink data-test-id="view-trace" to={target}>
              {cell}
            </StyledLink>
          </Tooltip>
        );
      }
    } else if (columnKey === 'replayId') {
      if (dataRow.replayId) {
        if (!dataRow['project.name']) {
          return getShortEventId(String(dataRow.replayId));
        }

        const target = replayLinkGenerator(organization, dataRow, undefined);
        cell = (
          <ViewReplayLink replayId={dataRow.replayId} to={target}>
            {cell}
          </ViewReplayLink>
        );
      }
    } else if (columnKey === 'profile.id') {
      const projectSlug = dataRow.project || dataRow['project.name'];
      const profileId = dataRow['profile.id'];

      if (projectSlug && profileId) {
        const target = generateProfileFlamechartRoute({
          orgSlug: organization.slug,
          projectSlug: String(projectSlug),
          profileId: String(profileId),
        });

        cell = (
          <StyledTooltip title={t('View Profile')}>
            <StyledLink
              data-test-id="view-profile"
              to={target}
              onClick={() =>
                trackAdvancedAnalyticsEvent('profiling_views.go_to_flamegraph', {
                  organization,
                  source: 'discover.table',
                })
              }
            >
              {cell}
            </StyledLink>
          </StyledTooltip>
        );
      }
    }

    const topResultsIndicator =
      isFirstPage && isTopEvents && rowIndex < topEvents && columnIndex === 0 ? (
        // Add one if we need to include Other in the series
        <TopResultsIndicator count={count} index={rowIndex} />
      ) : null;

    const fieldName = columnKey;
    const value = dataRow[fieldName];
    if (tableData.meta[fieldName] === 'integer' && defined(value) && value > 999) {
      return (
        <Tooltip
          title={value.toLocaleString()}
          containerDisplayMode="block"
          position="right"
        >
          {topResultsIndicator}
          <CellAction
            column={column}
            dataRow={dataRow}
            handleCellAction={handleCellAction(dataRow, column)}
          >
            {cell}
          </CellAction>
        </Tooltip>
      );
    }

    return (
      <Fragment>
        {topResultsIndicator}
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={handleCellAction(dataRow, column)}
        >
          {cell}
        </CellAction>
      </Fragment>
    );
  }

  function handleEditColumns() {
    const {
      organization,
      eventView,
      measurementKeys,
      spanOperationBreakdownKeys,
      customMeasurements,
    } = props;

    openModal(
      modalProps => (
        <ColumnEditModal
          {...modalProps}
          organization={organization}
          measurementKeys={measurementKeys}
          spanOperationBreakdownKeys={spanOperationBreakdownKeys}
          columns={eventView.getColumns().map(col => col.column)}
          onApply={handleUpdateColumns}
          customMeasurements={customMeasurements}
        />
      ),
      {modalCss, closeEvents: 'escape-key'}
    );
  }

  function handleCellAction(
    dataRow: TableDataRow,
    column: TableColumn<keyof TableDataRow>
  ) {
    return (action: Actions, value: React.ReactText) => {
      const {eventView, organization, location, tableData, isHomepage} = props;

      const query = new MutableSearch(eventView.query);

      let nextView = eventView.clone();

      trackAnalyticsEvent({
        eventKey: 'discover_v2.results.cellaction',
        eventName: 'Discoverv2: Cell Action Clicked',
        organization_id: parseInt(organization.id, 10),
        action,
      });

      switch (action) {
        case Actions.TRANSACTION: {
          const maybeProject = projects.find(
            project =>
              project.slug &&
              [dataRow['project.name'], dataRow.project].includes(project.slug)
          );
          const projectID = maybeProject ? [maybeProject.id] : undefined;

          const next = transactionSummaryRouteWithQuery({
            orgSlug: organization.slug,
            transaction: String(value),
            projectID,
            query: nextView.getPageFiltersQuery(),
          });

          browserHistory.push(normalizeUrl(next));
          return;
        }
        case Actions.RELEASE: {
          const maybeProject = projects.find(project => {
            return project.slug === dataRow.project;
          });

          browserHistory.push(
            normalizeUrl({
              pathname: `/organizations/${
                organization.slug
              }/releases/${encodeURIComponent(value)}/`,
              query: {
                ...nextView.getPageFiltersQuery(),

                project: maybeProject ? maybeProject.id : undefined,
              },
            })
          );

          return;
        }
        case Actions.DRILLDOWN: {
          // count_unique(column) drilldown

          trackAnalyticsEvent({
            eventKey: 'discover_v2.results.drilldown',
            eventName: 'Discoverv2: Click aggregate drilldown',
            organization_id: parseInt(organization.id, 10),
          });

          // Drilldown into each distinct value and get a count() for each value.
          nextView = getExpandedResults(nextView, {}, dataRow).withNewColumn({
            kind: 'function',
            function: ['count', '', undefined, undefined],
          });

          browserHistory.push(
            normalizeUrl(nextView.getResultsViewUrlTarget(organization.slug, isHomepage))
          );

          return;
        }
        default: {
          // Some custom perf metrics have units.
          // These custom perf metrics need to be adjusted to the correct value.
          let cellValue = value;
          const unit = tableData?.meta?.units?.[column.name];
          if (typeof cellValue === 'number' && unit) {
            if (Object.keys(SIZE_UNITS).includes(unit)) {
              cellValue *= SIZE_UNITS[unit];
            } else if (Object.keys(DURATION_UNITS).includes(unit)) {
              cellValue *= DURATION_UNITS[unit];
            }
          }
          updateQuery(query, action, column, cellValue);
        }
      }
      nextView.query = query.formatString();

      const target = nextView.getResultsViewUrlTarget(organization.slug, isHomepage);
      // Get yAxis from location
      target.query.yAxis = decodeList(location.query.yAxis);
      browserHistory.push(normalizeUrl(target));
    };
  }

  function handleUpdateColumns(columns: Column[]): void {
    const {organization, eventView, location, isHomepage} = props;

    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.update_columns',
      eventName: 'Discoverv2: Update columns',
      organization_id: parseInt(organization.id, 10),
    });

    const nextView = eventView.withColumns(columns);
    const resultsViewUrlTarget = nextView.getResultsViewUrlTarget(
      organization.slug,
      isHomepage
    );
    // Need to pull yAxis from location since eventView only stores 1 yAxis field at time
    const previousYAxis = decodeList(location.query.yAxis);
    resultsViewUrlTarget.query.yAxis = previousYAxis.filter(yAxis =>
      nextView.getYAxisOptions().find(({value}) => value === yAxis)
    );
    browserHistory.push(normalizeUrl(resultsViewUrlTarget));
  }

  function renderHeaderButtons() {
    const {
      organization,
      title,
      eventView,
      isLoading,
      error,
      tableData,
      location,
      onChangeShowTags,
      showTags,
    } = props;

    return (
      <TableActions
        title={title}
        isLoading={isLoading}
        error={error}
        organization={organization}
        eventView={eventView}
        onEdit={handleEditColumns}
        tableData={tableData}
        location={location}
        onChangeShowTags={onChangeShowTags}
        showTags={showTags}
      />
    );
  }

  const {error, eventView, isLoading, location, organization, tableData} = props;

  const columnOrder = eventView.getColumns();
  const columnSortBy = eventView.getSorts();

  const prependColumnWidths = eventView.hasAggregateField()
    ? ['40px']
    : eventView.hasIdField()
    ? []
    : [`minmax(${COL_WIDTH_MINIMUM}px, max-content)`];

  const replayIds = tableData?.data?.map(row => String(row.replayId)).filter(Boolean);

  return (
    <ReplayIdCountProvider organization={organization} replayIds={replayIds}>
      <GridEditable
        isLoading={isLoading}
        error={error}
        data={tableData ? tableData.data : []}
        columnOrder={columnOrder}
        columnSortBy={columnSortBy}
        title={t('Results')}
        grid={{
          renderHeadCell: _renderGridHeaderCell as any,
          renderBodyCell: _renderGridBodyCell as any,
          onResizeColumn: _resizeColumn as any,
          renderPrependColumns: _renderPrependColumns as any,
          prependColumnWidths,
        }}
        headerButtons={renderHeaderButtons}
        location={location}
      />
    </ReplayIdCountProvider>
  );
}

const PrependHeader = styled('span')`
  color: ${p => p.theme.subText};
`;

const StyledTooltip = styled(Tooltip)`
  display: initial;
  max-width: max-content;
`;

const StyledLink = styled(Link)`
  & div {
    display: inline;
  }
`;

const StyledIcon = styled(IconStack)`
  vertical-align: middle;
`;

export default TableView;
