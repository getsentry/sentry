import React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LegendComponentOption} from 'echarts';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {ErrorPanel} from 'sentry/components/charts/errorPanel';
import {TransitionChart} from 'sentry/components/charts/transitionChart';
import {TransparentLoadingMask} from 'sentry/components/charts/transparentLoadingMask';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {PlaceholderProps} from 'sentry/components/placeholder';
import {Placeholder} from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {EChartDataZoomHandler, EChartEventHandler} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {transformTableToCategoricalSeries} from 'sentry/utils/categoricalTimeSeries/transformTableToCategoricalSeries';
import type {EventsMetaType, MetaType} from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import type {AggregationOutputType, DataUnit, Sort} from 'sentry/utils/discover/fields';
import {
  isAggregateField,
  parseFunction,
  prettifyParsedFunction,
  stripDerivedMetricsPrefix,
} from 'sentry/utils/discover/fields';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {useTrackAnalyticsOnSpanMigrationError} from 'sentry/views/dashboards/hooks/useTrackAnalyticsOnSpanMigrationError';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {
  DashboardFilterKeys,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {getWidgetTableRowExploreUrlFunction} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';
import {getSelectedAggregateIndex} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import type {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';
import {AgentsTracesTableWidgetVisualization} from 'sentry/views/dashboards/widgets/agentsTracesTableWidget/agentsTracesTableWidgetVisualization';
import {BigNumberWidgetVisualization} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidgetVisualization';
import {CategoricalSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/categoricalSeriesWidgetVisualization';
import {Bars} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/plottables/bars';
import {
  ALLOWED_CELL_ACTIONS,
  MISSING_DATA_MESSAGE,
} from 'sentry/views/dashboards/widgets/common/settings';
import type {
  TabularColumn,
  TabularData,
} from 'sentry/views/dashboards/widgets/common/types';
import {DetailsWidgetVisualization} from 'sentry/views/dashboards/widgets/detailsWidget/detailsWidgetVisualization';
import type {DefaultDetailWidgetFields} from 'sentry/views/dashboards/widgets/detailsWidget/types';
import {RageAndDeadClicksWidgetVisualization} from 'sentry/views/dashboards/widgets/rageAndDeadClicksWidget/rageAndDeadClicksVisualization';
import {ServerTreeWidgetVisualization} from 'sentry/views/dashboards/widgets/serverTreeWidget/serverTreeWidgetVisualization';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {
  convertTableDataToTabularData,
  decodeColumnAliases,
} from 'sentry/views/dashboards/widgets/tableWidget/utils';
import {TextWidgetVisualization} from 'sentry/views/dashboards/widgets/textWidget/textWidgetVisualization';
import {WheelWidgetVisualization} from 'sentry/views/dashboards/widgets/wheelWidget/wheelWidgetVisualization';
import {WidgetError} from 'sentry/views/dashboards/widgets/widget/widgetError';
import {Actions} from 'sentry/views/discover/table/cellAction';
import {decodeColumnOrder} from 'sentry/views/discover/utils';
import {SpanFields} from 'sentry/views/insights/types';
import type {SpanResponse} from 'sentry/views/insights/types';

import type {GenericWidgetQueriesResult} from './genericWidgetQueries';

type TableComponentProps = Pick<
  GenericWidgetQueriesResult,
  'errorMessage' | 'loading' | 'tableResults'
> & {
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  disableTableActions?: boolean;
  minTableColumnWidth?: number;
  onWidgetTableResizeColumn?: (columns: TabularColumn[]) => void;
  onWidgetTableSort?: (sort: Sort) => void;
};

type WidgetCardChartProps = Pick<GenericWidgetQueriesResult, 'timeseriesResults'> &
  TableComponentProps & {
    widgetLegendState: WidgetLegendSelectionState;
    chartGroup?: string;
    confidence?: Confidence;
    dataScanned?: 'full' | 'partial';
    disableZoom?: boolean;
    isMobile?: boolean;
    isSampled?: boolean | null;
    legendOptions?: LegendComponentOption;
    noPadding?: boolean;
    onLegendSelectChanged?: EChartEventHandler<{
      name: string;
      selected: Record<string, boolean>;
      type: 'legendselectchanged';
    }>;
    onZoom?: EChartDataZoomHandler;
    sampleCount?: number;
    shouldResize?: boolean;
    showConfidenceWarning?: boolean;
    showLoadingText?: boolean;
    timeseriesResultsTypes?: Record<string, AggregationOutputType>;
    timeseriesResultsUnits?: Record<string, DataUnit>;
    windowWidth?: number;
  };

function WidgetCardChart(props: WidgetCardChartProps) {
  const {tableResults, errorMessage, loading, widget, noPadding, showLoadingText} = props;

  useTrackAnalyticsOnSpanMigrationError({errorMessage, widget, loading});

  if (errorMessage) {
    return (
      <StyledErrorPanel>
        <IconWarning variant="primary" size="lg" />
      </StyledErrorPanel>
    );
  }

  if (widget.displayType === 'table') {
    return getDynamicText({
      value: (
        <TransitionChart loading={loading} reloading={loading}>
          <LoadingScreen loading={loading} showLoadingText={showLoadingText} />
          <TableComponent tableResults={tableResults} {...props} />
        </TransitionChart>
      ),
      fixed: <Placeholder height="200px" testId="skeleton-ui" />,
    });
  }

  if (widget.displayType === 'big_number') {
    return (
      <TransitionChart loading={loading} reloading={loading}>
        <LoadingScreen loading={loading} showLoadingText={showLoadingText} />
        <BigNumberResizeWrapper noPadding={noPadding}>
          <BigNumberComponent tableResults={tableResults} {...props} />
        </BigNumberResizeWrapper>
      </TransitionChart>
    );
  }

  if (widget.displayType === DisplayType.DETAILS) {
    return (
      <TransitionChart loading={loading} reloading={loading}>
        <LoadingScreen loading={loading} showLoadingText={showLoadingText} />
        <DetailsComponent tableResults={tableResults} {...props} />
      </TransitionChart>
    );
  }

  if (widget.displayType === DisplayType.SERVER_TREE) {
    return <ServerTreeComponent dashboardFilters={props.dashboardFilters} />;
  }

  if (widget.displayType === DisplayType.RAGE_AND_DEAD_CLICKS) {
    return <RageAndDeadClicksWidgetVisualization />;
  }

  if (widget.displayType === DisplayType.WHEEL) {
    return (
      <TransitionChart loading={loading} reloading={loading}>
        <LoadingScreen loading={loading} showLoadingText={showLoadingText} />
        <WheelComponent tableResults={tableResults} {...props} />
      </TransitionChart>
    );
  }

  if (widget.displayType === DisplayType.CATEGORICAL_BAR) {
    return (
      <TransitionChart loading={loading} reloading={loading}>
        <LoadingScreen loading={loading} showLoadingText={showLoadingText} />
        <CategoricalSeriesComponent tableResults={tableResults} {...props} />
      </TransitionChart>
    );
  }

  if (widget.displayType === DisplayType.AGENTS_TRACES_TABLE) {
    return (
      <TableWrapper>
        <AgentsTracesTableWidgetVisualization
          limit={widget.limit ?? undefined}
          tableWidths={widget.tableWidths}
          dashboardFilters={props.dashboardFilters}
          frameless
        />
      </TableWrapper>
    );
  }

  if (widget.displayType === DisplayType.TEXT) {
    return (
      <TransitionChart loading={loading} reloading={loading}>
        <LoadingScreen loading={loading} showLoadingText={showLoadingText} />
        <TextComponent {...props} />
      </TransitionChart>
    );
  }

  return null;
}

function TableComponent({
  loading,
  tableResults,
  widget,
  minTableColumnWidth,
  onWidgetTableSort,
  onWidgetTableResizeColumn,
  disableTableActions,
  selection,
  dashboardFilters,
}: TableComponentProps): React.ReactNode {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const {projects} = useProjects();
  if (loading || !tableResults?.[0]) {
    // Align height to other charts.
    return <LoadingPlaceholder />;
  }

  const datasetConfig = getDatasetConfig(widget.widgetType);

  return tableResults.map((result, i) => {
    const fields = widget.queries[i]?.fields?.map(stripDerivedMetricsPrefix) ?? [];
    const fieldAliases = widget.queries[i]?.fieldAliases ?? [];
    const fieldHeaderMap = datasetConfig.getFieldHeaderMap?.() ?? {};
    const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);
    const columns = decodeColumnOrder(
      fields.map(field => ({
        field,
      })),
      tableResults[i]?.meta
    ).map((column, index) => {
      let sortable = false;
      if (column.key === SpanFields.IS_STARRED_TRANSACTION) {
        sortable = false;
      } else if (widget.widgetType === WidgetType.RELEASE) {
        sortable = isAggregateField(column.key);
      } else if (widget.widgetType !== WidgetType.ISSUE) {
        sortable = true;
      }
      return {
        key: column.key,
        width: widget.tableWidths?.[index] ?? minTableColumnWidth ?? column.width,
        type: column.type === 'never' ? null : column.type,
        sortable,
      };
    });
    const aliases = decodeColumnAliases(columns, fieldAliases, fieldHeaderMap);
    const tableData = convertTableDataToTabularData(tableResults?.[i]);
    const sort = decodeSorts(widget.queries[0]?.orderby)?.[0];

    // Inject any prettified function names that aren't currently aliased into the aliases
    for (const column of columns) {
      const parsedFunction = parseFunction(column.key);
      if (!aliases[column.key] && parsedFunction) {
        aliases[column.key] = prettifyParsedFunction(parsedFunction);
      }
    }

    let cellActions = ALLOWED_CELL_ACTIONS;
    if (disableTableActions) {
      cellActions = [];
    } else if (
      organization.features.includes('visibility-explore-view') &&
      widget.widgetType === WidgetType.SPANS
    ) {
      cellActions = [...ALLOWED_CELL_ACTIONS, Actions.OPEN_ROW_IN_EXPLORE];
    }

    return (
      <TableWrapper key={`table:${result.title}`}>
        <TableWidgetVisualization
          columns={columns}
          tableData={tableData}
          frameless
          scrollable
          aliases={aliases}
          onChangeSort={onWidgetTableSort}
          sort={sort}
          getRenderer={(field, _dataRow, meta) => {
            const customRenderer = datasetConfig.getCustomFieldRenderer?.(
              field,
              meta as MetaType,
              widget,
              organization,
              dashboardFilters
            )!;

            return customRenderer;
          }}
          makeBaggage={(field, _dataRow, meta) => {
            const unit = meta.units?.[field] as string | undefined;

            return {
              location,
              organization,
              projects,
              theme,
              unit,
              eventView,
            } satisfies RenderFunctionBaggage;
          }}
          onResizeColumn={onWidgetTableResizeColumn}
          allowedCellActions={cellActions}
          onTriggerCellAction={(action, _value, dataRow) => {
            if (action === Actions.OPEN_ROW_IN_EXPLORE) {
              const getExploreUrl = getWidgetTableRowExploreUrlFunction(
                selection,
                widget,
                organization,
                dashboardFilters
              );
              navigate(getExploreUrl(dataRow));
            }
          }}
        />
      </TableWrapper>
    );
  });
}

function BigNumberComponent({
  loading,
  tableResults,
  widget,
}: TableComponentProps): React.ReactNode {
  if (tableResults === undefined || loading) {
    return <BigNumber>{'\u2014'}</BigNumber>;
  }

  return tableResults.map((result, i) => {
    const tableMeta = {...result.meta};
    const fields = Object.keys(tableMeta?.fields ?? {});

    let field = fields[0]!;
    let selectedField = field;

    if (defined(widget.queries[0]!.selectedAggregate)) {
      const index = widget.queries[0]!.selectedAggregate;
      selectedField = widget.queries[0]!.aggregates[index]!;
      if (fields.includes(selectedField)) {
        field = selectedField;
      }
    }

    const data = result?.data;
    const meta = result?.meta as EventsMetaType;
    const value = data?.[0]?.[selectedField];

    if (
      !field ||
      !result.data?.length ||
      selectedField === 'equation|' ||
      selectedField === '' ||
      !defined(value) ||
      !Number.isFinite(value) ||
      Number.isNaN(value)
    ) {
      return <BigNumber key={`big_number:${result.title}`}>{'\u2014'}</BigNumber>;
    }

    return (
      <BigNumberWidgetVisualization
        key={i}
        field={field}
        value={value}
        type={meta.fields?.[field] ?? null}
        unit={(meta.units?.[field] as DataUnit) ?? null}
        thresholds={widget.thresholds ?? undefined}
        // TODO: preferredPolarity has been added to ThresholdsConfig as a property,
        // we should remove this prop fromBigNumberWidgetVisualization
        preferredPolarity={widget.thresholds?.preferredPolarity ?? '-'}
      />
    );
  });
}

function CategoricalSeriesComponent(props: TableComponentProps): React.ReactNode {
  const {widget, tableResults, loading} = props;

  if (loading || !tableResults?.[0]) {
    return <LoadingPlaceholder />;
  }

  const query = widget.queries[0];
  const tableData = tableResults[0];

  if (!query || !tableData.meta) {
    return (
      <StyledErrorPanel>
        <IconWarning variant="primary" size="lg" />
      </StyledErrorPanel>
    );
  }

  // When multiple aggregates exist, only plot the selected one (radio selection).
  // This mirrors Big Number behavior — all aggregates are queried, but only
  // one is rendered at a time.
  const selectedIndex = getSelectedAggregateIndex(
    query.selectedAggregate,
    query.aggregates.length
  );
  const selectedAggregate = query.aggregates[selectedIndex];
  // Filter query to only the selected aggregate.
  const filteredQuery = selectedAggregate
    ? {...query, aggregates: [selectedAggregate]}
    : query;

  const categoricalSeriesData = transformTableToCategoricalSeries(filteredQuery, {
    data: tableData.data,
    meta: {
      fields: (tableData.meta.fields ?? {}) as TabularData['meta']['fields'],
      units: (tableData.meta.units ?? {}) as TabularData['meta']['units'],
    },
  });

  // Empty series array means the widget is misconfigured (missing X-axis or aggregate)
  // This is different from "no data found" which would return series with empty values
  if (categoricalSeriesData.length === 0) {
    return (
      <StyledErrorPanel>
        <IconWarning variant="primary" size="lg" />
      </StyledErrorPanel>
    );
  }

  // Create Bars plottables from the transformed data
  const plottables = categoricalSeriesData.map(series => new Bars(series));

  return (
    <ChartWrapper autoHeightResize>
      <CategoricalSeriesWidgetVisualization plottables={plottables} {...props} />
    </ChartWrapper>
  );
}

function DetailsComponent(props: TableComponentProps): React.ReactNode {
  const {tableResults, loading} = props;

  const singleSpan = tableResults?.[0]?.data?.[0] as
    | Pick<SpanResponse, DefaultDetailWidgetFields>
    | undefined;

  if (!singleSpan) {
    if (loading) {
      return null;
    }
    return <WidgetError error={MISSING_DATA_MESSAGE} />;
  }

  return <DetailsWidgetVisualization span={singleSpan} />;
}

function ServerTreeComponent({
  dashboardFilters,
}: {
  dashboardFilters?: DashboardFilters;
}): React.ReactNode {
  const globalFilters = dashboardFilters?.[DashboardFilterKeys.GLOBAL_FILTER] || [];

  const transactionFilter = globalFilters.find(
    filter => filter.tag.key === 'transaction' && filter.dataset === WidgetType.SPANS
  );

  return (
    <ServerTreeWidgetVisualization
      noVisualizationPadding
      query={transactionFilter?.value}
    />
  );
}

function WheelComponent(props: TableComponentProps): React.ReactNode {
  return <WheelWidgetVisualization tableResults={props.tableResults} />;
}

function TextComponent(props: TableComponentProps): React.ReactNode {
  const hasTextWidgets = useOrganization().features.includes('dashboards-text-widgets');

  if (!hasTextWidgets) {
    return null;
  }

  return <TextWidgetVisualization text={props.widget.description} />;
}

function shouldMemoizeWidgetCardChart(
  prevProps: WidgetCardChartProps,
  props: WidgetCardChartProps
) {
  if (
    prevProps.widget.displayType === DisplayType.BIG_NUMBER &&
    props.widget.displayType === DisplayType.BIG_NUMBER &&
    (prevProps.windowWidth !== props.windowWidth ||
      !isEqual(prevProps.widget?.layout, props.widget?.layout))
  ) {
    return false;
  }

  // Widget title changes should not update the WidgetCardChart component tree
  const currentProps = {
    ...omit(prevProps, ['windowWidth']),
    widget: {
      ...prevProps.widget,
      title: '',
    },
  };

  props = {
    ...omit(props, ['windowWidth']),
    widget: {
      ...props.widget,
      title: '',
    },
  };
  return isEqual(currentProps, props);
}

export default React.memo(WidgetCardChart, shouldMemoizeWidgetCardChart);

const StyledTransparentLoadingMask = styled((props: any) => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  justify-content: center;
  align-items: center;
  pointer-events: none;
`;

function LoadingScreen({
  loading,
  showLoadingText,
}: {
  loading: boolean;
  showLoadingText?: boolean;
}) {
  if (!loading) {
    return null;
  }

  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
      {showLoadingText && (
        <p id="loading-text">{t('Turning data into pixels - almost ready')}</p>
      )}
    </StyledTransparentLoadingMask>
  );
}

const LoadingPlaceholder = styled(({className}: PlaceholderProps) => (
  <Placeholder height="200px" className={className} />
))`
  background-color: ${p => p.theme.tokens.background.secondary};
`;

const BigNumberResizeWrapper = styled('div')<{noPadding?: boolean}>`
  flex-grow: 1;
  overflow: hidden;
  position: relative;
  padding: ${p =>
    p.noPadding
      ? '0'
      : `${p.theme.space.md} ${p.theme.space['2xl']} ${p.theme.space['2xl']} ${p.theme.space['2xl']}`};
`;

const BigNumber = styled('div')`
  line-height: 1;
  display: inline-flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  font-size: 32px;
  color: ${p => p.theme.tokens.content.primary};

  * {
    text-align: left !important;
  }
`;

const ChartWrapper = styled('div')<{autoHeightResize: boolean; noPadding?: boolean}>`
  ${p => p.autoHeightResize && 'height: 100%;'}
  width: 100%;
  padding: ${p => (p.noPadding ? '0' : `0 ${p.theme.space.xl} ${p.theme.space.xl}`)};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const TableWrapper = styled('div')`
  margin-top: ${p => p.theme.space.lg};
  min-height: 0;
  border-bottom-left-radius: ${p => p.theme.radius.md};
  border-bottom-right-radius: ${p => p.theme.radius.md};
`;

const StyledErrorPanel = styled(ErrorPanel)`
  padding: ${p => p.theme.space.xl};
`;
