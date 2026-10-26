import {Fragment, useMemo, useState} from 'react';
import {closestCenter, DndContext, DragOverlay} from '@dnd-kit/core';
import {arrayMove, SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconDelete} from '@sentry/icons/delete';
import cloneDeep from 'lodash/cloneDeep';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import type {SelectValue} from '@sentry/scraps/select';

import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {generateFieldAsString, type QueryFieldValue} from 'sentry/utils/discover/fields';
import {classifyTagKey, prettifyTagKey} from 'sentry/utils/fields';
import {useCustomMeasurements} from 'sentry/utils/useCustomMeasurements';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTags} from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {correctDragOverlayOffset} from 'sentry/views/dashboards/widgetBuilder/components/common/draggableUtils';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {SortableVisualizeFieldWrapper} from 'sentry/views/dashboards/widgetBuilder/components/common/sortableFieldWrapper';
import {ExploreArithmeticBuilder} from 'sentry/views/dashboards/widgetBuilder/components/exploreArithmeticBuilder';
import {AggregateParameterField} from 'sentry/views/dashboards/widgetBuilder/components/visualize/aggregateParameterField';
import {SelectRow} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
import {buildTraceItemColumnOptions} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceItemColumnOptions';
import {MetricSelectRow} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricSelectRow';
import {MetricsEquationVisualize} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize';
import {
  NONE,
  _sortFn,
  getColumnOptions,
  getAggregateValueKey,
  renderTag,
  LegendAliasInput,
  ParameterRefinements,
  FieldBar,
  FieldRow,
  FieldExtras,
  StyledArithmeticInput,
} from 'sentry/views/dashboards/widgetBuilder/components/visualize/utils';
import {VisualizeGhostField} from 'sentry/views/dashboards/widgetBuilder/components/visualize/visualizeGhostField';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/constants';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/useWidgetBuilderContext';
import {useDashboardWidgetSource} from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import {useDisableTransactionWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useDisableTransactionWidget';
import {useIsEditingWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import type {TraceMetricsVisualizeModeState} from 'sentry/views/dashboards/widgetBuilder/hooks/useTraceMetricsVisualizeModeState';
import {useWidgetBuilderTraceItemConfig} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderTraceItemConfig';
import {SESSIONS_TAGS} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';
import {MAX_METRICS_ALLOWED} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {withBaseConditionalAggregateField} from 'sentry/views/explore/utils/conditionalAggregate';

const NONE_AGGREGATE = {
  textValue: t('field'),
  label: tct('[emphasis:field]', {emphasis: <em />}),
  value: NONE,
  trailingItems: null,
};

function canDeleteField(
  dataset: WidgetType,
  selectedFields: QueryFieldValue[],
  field: QueryFieldValue
) {
  if (dataset === WidgetType.RELEASE) {
    // Release Health widgets are required to have at least one aggregate
    return (
      selectedFields.filter(
        selectedField => selectedField.kind === FieldValueKind.FUNCTION
      ).length > 1 || field.kind === FieldValueKind.FIELD
    );
  }
  if (dataset === WidgetType.TRACEMETRICS) {
    // Trace metric tables only support aggregates. Keep the last aggregate so
    // a table cannot become a samples-only query.
    return (
      selectedFields.filter(
        selectedField =>
          selectedField.kind === FieldValueKind.FUNCTION ||
          selectedField.kind === FieldValueKind.EQUATION
      ).length > 1 || field.kind === FieldValueKind.FIELD
    );
  }
  return true;
}

interface VisualizeProps {
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
  traceMetricsVisualizeMode?: TraceMetricsVisualizeModeState;
}

export function Visualize({error, setError, traceMetricsVisualizeMode}: VisualizeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const organization = useOrganization();
  const theme = useTheme();
  const {state, dispatch} = useWidgetBuilderContext();
  const tags = useTags();
  const {customMeasurements} = useCustomMeasurements();
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();
  const disableTransactionWidget = useDisableTransactionWidget();

  const isTimeSeriesWidget = usesTimeSeriesData(state.displayType);
  const isBigNumberWidget = state.displayType === DisplayType.BIG_NUMBER;
  const isTableWidget = state.displayType === DisplayType.TABLE;
  const isCategoricalBarWidget = state.displayType === DisplayType.CATEGORICAL_BAR;
  // Heat maps store their single "Visualize" aggregate in state.fields and use
  // radio selection, mirroring Big Number.
  const isHeatmapWidget = state.displayType === DisplayType.HEATMAP;

  // Heat maps don't support equations, so the equation mode toggle and the
  // "Add Equation" affordances are hidden for them.
  const canShowTraceMetricEquations =
    state.dataset === WidgetType.TRACEMETRICS && !isHeatmapWidget;

  const {isEquationMode, handleModeToggle, equationSnapshot} =
    traceMetricsVisualizeMode ?? {
      isEquationMode: false,
      handleModeToggle: () => {},
      equationSnapshot: {current: null},
    };

  let hiddenKeys: string[] = [];
  if (state.dataset === WidgetType.TRACEMETRICS) {
    hiddenKeys = HiddenTraceMetricSearchFields;
  }
  const {traceItemType, ...traceItemOptions} = useWidgetBuilderTraceItemConfig();
  const {attributes: numericSpanTags} = useTraceItemDatasetAttributes(
    traceItemType,
    traceItemOptions,
    'number',
    hiddenKeys
  );
  const {attributes: stringSpanTags} = useTraceItemDatasetAttributes(
    traceItemType,
    traceItemOptions,
    'string',
    hiddenKeys
  );
  const {attributes: booleanSpanTags} = useTraceItemDatasetAttributes(
    traceItemType,
    traceItemOptions,
    'boolean',
    hiddenKeys
  );

  // Span column options are explicitly defined and bypass all of the
  // fieldOptions filtering and logic used for showing options for
  // chart types.
  const traceItemColumnOptions = useMemo(() => {
    if (
      state.dataset !== WidgetType.SPANS &&
      state.dataset !== WidgetType.LOGS &&
      state.dataset !== WidgetType.TRACEMETRICS
    ) {
      return [];
    }
    const columns =
      state.fields
        ?.filter(field => field.kind === FieldValueKind.FIELD)
        .map(field => field.field) ?? [];
    const options: Array<SelectValue<string> & {label: string; value: string}> = [
      // Columns that are not in the tag responses, e.g. old tags
      ...columns
        .filter(
          column =>
            column !== '' &&
            !Object.hasOwn(stringSpanTags, column) &&
            !Object.hasOwn(numericSpanTags, column) &&
            !Object.hasOwn(booleanSpanTags, column)
        )
        .map(column => {
          return {
            label: prettifyTagKey(column),
            value: column,
            trailingItems: () => <TypeBadge kind={classifyTagKey(column)} />,
          };
        }),
      ...buildTraceItemColumnOptions({
        booleanTags: booleanSpanTags,
        stringTags: stringSpanTags,
        numberTags: numericSpanTags,
      }),
    ];
    options.sort(_sortFn);
    return options;
  }, [state.dataset, state.fields, stringSpanTags, numericSpanTags, booleanSpanTags]);

  const datasetConfig = useMemo(() => getDatasetConfig(state.dataset), [state.dataset]);

  // Determines which state field stores the visualization fields:

  // - Line, Area, Bar (Time Series): use state.yAxis for aggregates
  // - Table, Big Number: use state.fields for all columns (fields + aggregates)
  // - Bar (Categorical): uses state.fields with one X-axis (FIELD kind) and one or more
  //   aggregates (FUNCTION/EQUATION kind). Like Big Number, supports radio selection.
  const usesYAxisState = isTimeSeriesWidget && !isCategoricalBarWidget;
  const allFields = usesYAxisState ? state.yAxis : state.fields;
  // For categorical bars, only show aggregate fields (FUNCTION kind) in the
  // Visualize section. There should be exactly one in the state. The X-axis
  // field (FIELD kind) is managed separately in the X-Axis selector
  const aggregateFields = isCategoricalBarWidget
    ? allFields?.filter(
        f => f.kind === FieldValueKind.FUNCTION || f.kind === FieldValueKind.EQUATION
      )
    : null;

  const fields = isCategoricalBarWidget
    ? aggregateFields
    : usesYAxisState
      ? state.yAxis
      : state.fields;

  const canHaveAlias = isTableWidget;

  // Determines whether "Add Series/Column/Equation" buttons are shown:
  // - Line, Area, Bar (Time Series): Can add multiple Y-axis series
  // - Table: Can add multiple columns
  // - Big Number / Bar (Categorical): Can add fields only if equations are enabled for the dataset
  const canAddFields =
    isTimeSeriesWidget ||
    isTableWidget ||
    ((isBigNumberWidget || isCategoricalBarWidget || isHeatmapWidget) &&
      (datasetConfig.enableEquations || canShowTraceMetricEquations));
  // Determines which action to use for updating visualization fields:
  // - Line, Area, Bar (Time Series): SET_Y_AXIS for Y-axis aggregates
  // - Bar (Categorical): SET_CATEGORICAL_AGGREGATE (reducer handles merging with X-axis)
  // - Other widgets (Table, Big Number): SET_FIELDS for all columns
  const updateAction = usesYAxisState
    ? BuilderStateAction.SET_Y_AXIS
    : isCategoricalBarWidget
      ? BuilderStateAction.SET_CATEGORICAL_AGGREGATE
      : BuilderStateAction.SET_FIELDS;

  const tooltipText = isTimeSeriesWidget
    ? t(
        'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
      )
    : isCategoricalBarWidget
      ? t(
          'Primary metric that appears in your chart. You can add equations and select which one to display.'
        )
      : t('Columns to display in your table. You can also add equations.');

  const fieldOptions = useMemo(() => {
    // Explicitly merge numeric and string tags to ensure filtering
    // compatibility for timeseries chart types.
    if (
      state.dataset === WidgetType.SPANS ||
      state.dataset === WidgetType.LOGS ||
      state.dataset === WidgetType.TRACEMETRICS
    ) {
      return datasetConfig.getTableFieldOptions(
        organization,
        {...booleanSpanTags, ...numericSpanTags, ...stringSpanTags},
        customMeasurements
      );
    }
    return datasetConfig.getTableFieldOptions(
      organization,
      tags,
      customMeasurements,
      undefined,
      state.displayType
    );
  }, [
    booleanSpanTags,
    customMeasurements,
    datasetConfig,
    numericSpanTags,
    organization,
    state.dataset,
    state.displayType,
    stringSpanTags,
    tags,
  ]);

  const aggregates = useMemo(
    () =>
      Object.values(fieldOptions).filter(option =>
        datasetConfig.filterYAxisOptions?.(state.displayType ?? DisplayType.TABLE)(option)
      ),
    [fieldOptions, state.displayType, datasetConfig]
  );

  // Used to extract selected aggregates and parameters from the fields
  const stringFields = fields?.map(generateFieldAsString);

  const fieldErrors = Array.isArray(error?.queries)
    ? error.queries.find((queryError: any) => queryError?.fields)?.fields
    : undefined;
  const aggregateErrors = Array.isArray(error?.queries)
    ? error.queries.find((aggregateError: any) => aggregateError?.aggregates)?.aggregates
    : undefined;

  const canDrag =
    fields?.length &&
    fields.length > 1 &&
    state.displayType !== DisplayType.BIG_NUMBER &&
    state.displayType !== DisplayType.CATEGORICAL_BAR &&
    state.displayType !== DisplayType.HEATMAP;

  const draggableFieldIds = fields?.map((_field, index) => index.toString()) ?? [];

  // Default field to add to the widget query when adding a new field.
  const defaultField =
    (isTimeSeriesWidget && datasetConfig.defaultSeriesField) ||
    datasetConfig.defaultField;

  const baseAggregateOptions = useMemo(
    () =>
      aggregates.map(option => ({
        value:
          option.value.kind === FieldValueKind.FUNCTION
            ? getAggregateValueKey(option.value.meta.name)
            : option.value.meta.name,
        label: option.value.meta.name,
        trailingItems: () => renderTag(option.value.kind, option.value.meta.name) ?? null,
      })),
    [aggregates]
  );

  // Release dataset tables only use specific fields from SESSIONS_TAGS
  const releaseSessionTagsOptions = useMemo(() => {
    if (state.dataset !== WidgetType.RELEASE) {
      return [];
    }
    return Object.values(fieldOptions)
      .filter(option => SESSIONS_TAGS.includes(option.value.meta.name))
      .map(option => ({
        label: option.value.meta.name,
        value: option.value.meta.name,
        textValue: option.value.meta.name,
        trailingItems: () => renderTag(option.value.kind, option.value.meta.name),
      }))
      .sort(_sortFn);
  }, [state.dataset, fieldOptions]);

  // Column options for table widgets - includes all fields without any filtering
  // imposed by the aggregate filtering its possible columns
  const tableFieldOptions = useMemo(() => {
    if (
      isTimeSeriesWidget ||
      isBigNumberWidget ||
      state.dataset === WidgetType.ISSUE ||
      state.dataset === WidgetType.SPANS ||
      state.dataset === WidgetType.LOGS ||
      state.dataset === WidgetType.TRACEMETRICS ||
      state.dataset === WidgetType.RELEASE
    ) {
      return [];
    }
    return Object.values(fieldOptions)
      .filter(option => option.value.kind !== FieldValueKind.FUNCTION)
      .map(option => ({
        label: option.value.meta.name,
        value: option.value.meta.name,
        textValue: option.value.meta.name,
        trailingItems: () =>
          renderTag(
            option.value.kind,
            option.value.meta.name,
            option.value.kind !== FieldValueKind.FUNCTION &&
              option.value.kind !== FieldValueKind.EQUATION
              ? option.value.meta.dataType
              : undefined
          ),
      }))
      .sort(_sortFn);
  }, [isTimeSeriesWidget, isBigNumberWidget, state.dataset, fieldOptions]);

  const computedAggregateOptions = useMemo(() => {
    // Categorical bars and heat maps only allow aggregates, no field columns
    if (
      isTimeSeriesWidget ||
      isBigNumberWidget ||
      isCategoricalBarWidget ||
      isHeatmapWidget
    ) {
      return {type: 'chart' as const, options: baseAggregateOptions};
    }

    const baseOptions = [NONE_AGGREGATE, ...baseAggregateOptions];

    // Issue widgets don't have aggregates, set to baseOptions to include the NONE_AGGREGATE label
    if (state.dataset === WidgetType.ISSUE) {
      return {type: 'issue' as const, options: baseOptions};
    }
    // Add span column options for Spans dataset
    if (
      state.dataset === WidgetType.SPANS ||
      state.dataset === WidgetType.LOGS ||
      state.dataset === WidgetType.TRACEMETRICS
    ) {
      return {
        type: 'trace' as const,
        options: [...baseOptions, ...traceItemColumnOptions],
      };
    }
    if (state.dataset === WidgetType.RELEASE) {
      return {
        type: 'release' as const,
        optionsWithNone: [...baseOptions, ...releaseSessionTagsOptions],
        optionsWithoutNone: [...baseAggregateOptions, ...releaseSessionTagsOptions],
      };
    }
    // Add column options to the aggregate dropdown for non-Issue and non-Spans datasets
    return {type: 'table' as const, options: [...baseOptions, ...tableFieldOptions]};
  }, [
    isTimeSeriesWidget,
    isBigNumberWidget,
    isCategoricalBarWidget,
    isHeatmapWidget,
    state.dataset,
    baseAggregateOptions,
    traceItemColumnOptions,
    releaseSessionTagsOptions,
    tableFieldOptions,
  ]);

  const hasMaxMetrics =
    state.dataset === WidgetType.TRACEMETRICS &&
    ((fields ?? state.yAxis)?.filter((field: QueryFieldValue) =>
      [FieldValueKind.FUNCTION, FieldValueKind.EQUATION].includes(
        field.kind as FieldValueKind
      )
    )?.length ?? 0) >= MAX_METRICS_ALLOWED;

  return (
    <Fragment>
      <SectionHeader
        title={isTableWidget ? t('Columns') : t('Visualize')}
        tooltipText={tooltipText}
      />
      {canShowTraceMetricEquations && (
        <Container paddingBottom="md">
          <SegmentedControl
            aria-label={t('Visualization mode')}
            value={isEquationMode ? 'equation' : 'series'}
            onChange={value => handleModeToggle(value === 'equation')}
            size="sm"
          >
            <SegmentedControl.Item key="series">{t('Series')}</SegmentedControl.Item>
            <SegmentedControl.Item key="equation">{t('Equation')}</SegmentedControl.Item>
          </SegmentedControl>
        </Container>
      )}
      {isEquationMode && canShowTraceMetricEquations ? (
        <MetricsEquationVisualize equationSnapshot={equationSnapshot} />
      ) : (
        <Fragment>
          <StyledFieldGroup
            error={isTimeSeriesWidget ? aggregateErrors : fieldErrors}
            inline={false}
            flexibleControlStateSize
          >
            <DndContext
              collisionDetection={closestCenter}
              onDragStart={({active}) => {
                setActiveId(active.id.toString());
              }}
              onDragEnd={({over, active}) => {
                setActiveId(null);

                if (over) {
                  const getIndex = draggableFieldIds.indexOf.bind(draggableFieldIds);
                  const activeIndex = getIndex(active.id);
                  const overIndex = getIndex(over.id);

                  if (activeIndex !== overIndex) {
                    dispatch({
                      type: updateAction,
                      payload: arrayMove(fields ?? [], activeIndex, overIndex),
                    });
                  }
                }
              }}
              onDragCancel={() => setActiveId(null)}
            >
              <SortableContext
                items={draggableFieldIds}
                strategy={verticalListSortingStrategy}
              >
                <Stack gap="md">
                  {fields?.map((field, index) => {
                    const canDelete = canDeleteField(
                      state.dataset ?? WidgetType.ERRORS,
                      fields,
                      field
                    );

                    const isOnlyFieldOrAggregate =
                      fields.length === 2 &&
                      field.kind !== FieldValueKind.EQUATION &&
                      fields.some(
                        fieldItem => fieldItem.kind === FieldValueKind.EQUATION
                      ) &&
                      // The spans dataset can have a single equation, so isOnlyFieldOrAggregate
                      // is not applicable. The errors dataset requires one series to be
                      // selected for equations to work.
                      state.dataset !== WidgetType.SPANS;

                    // Depending on the dataset and the display type, we use different options for
                    // displaying in the column select.
                    // For charts, we show aggregate parameter options for the y-axis as primary options.
                    // For tables, we show all string tags and fields as primary options, as well
                    // as aggregates that don't take parameters.
                    const columnFilterMethod = isTimeSeriesWidget
                      ? datasetConfig.filterYAxisAggregateParams?.(
                          field,
                          state.displayType ?? DisplayType.LINE
                        )
                      : field.kind === FieldValueKind.FUNCTION
                        ? datasetConfig.filterAggregateParams
                        : datasetConfig.filterTableOptions;
                    const columnOptions =
                      (state.dataset === WidgetType.SPANS ||
                        state.dataset === WidgetType.LOGS ||
                        state.dataset === WidgetType.TRACEMETRICS) &&
                      field.kind !== FieldValueKind.FUNCTION
                        ? traceItemColumnOptions
                        : getColumnOptions(
                            state.dataset ?? WidgetType.ERRORS,
                            field,
                            fieldOptions,
                            // If no column filter method is provided, show all options
                            columnFilterMethod ?? (() => true)
                          );

                    let aggregateOptions: Array<
                      | {
                          label: string | React.ReactNode;
                          trailingItems: React.ReactNode | null;
                          value: string;
                          textValue?: string;
                        }
                      | SelectValue<string>
                    >;

                    if (computedAggregateOptions.type === 'release') {
                      aggregateOptions = canDelete
                        ? computedAggregateOptions.optionsWithNone
                        : computedAggregateOptions.optionsWithoutNone;
                    } else {
                      aggregateOptions = computedAggregateOptions.options;
                    }

                    let matchingAggregate: any;
                    if (
                      fields[index]!.kind === FieldValueKind.FUNCTION &&
                      FieldValueKind.FUNCTION in fields[index]!
                    ) {
                      const fieldForMatch =
                        state.dataset === WidgetType.SPANS
                          ? withBaseConditionalAggregateField(fields[index]!)
                          : fields[index]!;
                      matchingAggregate = aggregates.find(
                        option =>
                          option.value.meta.name ===
                          (fieldForMatch.kind === FieldValueKind.FUNCTION
                            ? fieldForMatch.function[0]
                            : undefined)
                      );
                    }

                    const parameterRefinements =
                      matchingAggregate?.value.meta.parameters.length > 1
                        ? matchingAggregate?.value.meta.parameters.slice(1)
                        : [];

                    // Apdex and User Misery are special cases where the column parameter is not applicable
                    const isApdexOrUserMisery =
                      matchingAggregate?.value.meta.name === 'apdex' ||
                      matchingAggregate?.value.meta.name === 'user_misery';

                    const hasColumnParameter =
                      (fields[index]!.kind === FieldValueKind.FUNCTION &&
                        !isApdexOrUserMisery &&
                        matchingAggregate?.value.meta.parameters.length !== 0) ||
                      fields[index]!.kind === FieldValueKind.FIELD;

                    return (
                      <SortableVisualizeFieldWrapper
                        dragId={draggableFieldIds[index] ?? ''}
                        canDrag={!!canDrag}
                        key={draggableFieldIds[index]}
                      >
                        {activeId !== null && index === Number(activeId) ? null : (
                          <FieldRow>
                            {fields.length > 1 &&
                              (state.displayType === DisplayType.BIG_NUMBER ||
                                state.displayType === DisplayType.CATEGORICAL_BAR ||
                                state.displayType === DisplayType.HEATMAP) && (
                                <RadioLineItem
                                  index={index}
                                  role="radio"
                                  aria-label="aggregate-selector"
                                >
                                  <Radio
                                    checked={index === state.selectedAggregate}
                                    onChange={() => {
                                      dispatch({
                                        type: BuilderStateAction.SET_SELECTED_AGGREGATE,
                                        payload: index,
                                      });
                                    }}
                                    onClick={() => {
                                      trackAnalytics(
                                        'dashboards_views.widget_builder.change',
                                        {
                                          builder_version: WidgetBuilderVersion.SLIDEOUT,
                                          field: 'visualize.selectAggregate',
                                          from: source,
                                          new_widget: !isEditing,
                                          value: '',
                                          widget_type: state.dataset ?? '',
                                          organization,
                                        }
                                      );
                                    }}
                                    aria-label={'field' + index}
                                  />
                                </RadioLineItem>
                              )}
                            <FieldBar data-testid="field-bar">
                              {field.kind === FieldValueKind.EQUATION ? (
                                state.dataset === WidgetType.SPANS ? (
                                  <ExploreArithmeticBuilder
                                    equation={field.field}
                                    onUpdate={value => {
                                      dispatch({
                                        type: updateAction,
                                        payload: fields.map((_field, i) =>
                                          i === index ? {..._field, field: value} : _field
                                        ),
                                      });
                                      setError?.({...error, queries: []});
                                      trackAnalytics(
                                        'dashboards_views.widget_builder.change',
                                        {
                                          builder_version: WidgetBuilderVersion.SLIDEOUT,
                                          field: 'visualize.updateEquation',
                                          from: source,
                                          new_widget: !isEditing,
                                          value: '',
                                          widget_type: state.dataset ?? '',
                                          organization,
                                        }
                                      );
                                    }}
                                  />
                                ) : (
                                  <StyledArithmeticInput
                                    name="arithmetic"
                                    key="parameter:text"
                                    type="text"
                                    value={field.field}
                                    disabled={disableTransactionWidget}
                                    onUpdate={value => {
                                      dispatch({
                                        type: updateAction,
                                        payload: fields.map((_field, i) =>
                                          i === index ? {..._field, field: value} : _field
                                        ),
                                      });
                                      setError?.({...error, queries: []});
                                      trackAnalytics(
                                        'dashboards_views.widget_builder.change',
                                        {
                                          builder_version: WidgetBuilderVersion.SLIDEOUT,
                                          field: 'visualize.updateEquation',
                                          from: source,
                                          new_widget: !isEditing,
                                          value: '',
                                          widget_type: state.dataset ?? '',
                                          organization,
                                        }
                                      );
                                    }}
                                    options={fields}
                                    placeholder={t('Equation')}
                                    aria-label={t('Equation')}
                                  />
                                )
                              ) : (
                                <Fragment>
                                  {state.dataset === WidgetType.TRACEMETRICS ? (
                                    <MetricSelectRow
                                      // Heat maps always count() the metric, so
                                      // the aggregate function is locked (only the
                                      // metric is selectable), mirroring Explore.
                                      disabled={
                                        disableTransactionWidget || isHeatmapWidget
                                      }
                                      field={field}
                                      fieldSelector={autoSelectFirstColumn =>
                                        field.kind === FieldValueKind.FIELD ? (
                                          <SelectRow
                                            autoSelectFirstColumn={autoSelectFirstColumn}
                                            showAggregateSelector={false}
                                            field={field}
                                            index={index}
                                            hasColumnParameter={hasColumnParameter}
                                            columnOptions={columnOptions}
                                            aggregateOptions={aggregateOptions}
                                            stringFields={stringFields}
                                            error={error}
                                            setError={setError}
                                            fields={fields}
                                            source={source}
                                            isEditing={isEditing}
                                            fieldOptions={fieldOptions}
                                            columnFilterMethod={columnFilterMethod}
                                            aggregates={aggregates}
                                            disabled={disableTransactionWidget}
                                          />
                                        ) : undefined
                                      }
                                      index={index}
                                    />
                                  ) : (
                                    <SelectRow
                                      field={field}
                                      index={index}
                                      hasColumnParameter={hasColumnParameter}
                                      columnOptions={columnOptions}
                                      aggregateOptions={aggregateOptions}
                                      stringFields={stringFields}
                                      error={error}
                                      setError={setError}
                                      fields={fields}
                                      source={source}
                                      isEditing={isEditing}
                                      fieldOptions={fieldOptions}
                                      columnFilterMethod={columnFilterMethod}
                                      aggregates={aggregates}
                                      disabled={disableTransactionWidget}
                                    />
                                  )}
                                  {field.kind === FieldValueKind.FUNCTION &&
                                    parameterRefinements.length > 0 && (
                                      <ParameterRefinements>
                                        {parameterRefinements.map(
                                          (parameter: any, parameterIndex: any) => {
                                            // The current value is displaced by 2 because the first two parameters
                                            // are the aggregate name and the column selection
                                            const currentValue =
                                              field.function[parameterIndex + 2] || '';
                                            const key = `${field.function.join('_')}-${parameterIndex}`;
                                            return (
                                              <AggregateParameterField
                                                key={key}
                                                parameter={parameter}
                                                fieldValue={field}
                                                currentValue={currentValue}
                                                onChange={value => {
                                                  const newFields = cloneDeep(fields);
                                                  if (
                                                    newFields[index]!.kind !==
                                                    FieldValueKind.FUNCTION
                                                  ) {
                                                    return;
                                                  }
                                                  newFields[index]!.function[
                                                    parameterIndex + 2
                                                  ] = value;
                                                  dispatch({
                                                    type: updateAction,
                                                    payload: newFields,
                                                  });
                                                  setError?.({...error, queries: []});
                                                }}
                                              />
                                            );
                                          }
                                        )}
                                      </ParameterRefinements>
                                    )}
                                  {isApdexOrUserMisery &&
                                    field.kind === FieldValueKind.FUNCTION && (
                                      <AggregateParameterField
                                        parameter={
                                          matchingAggregate?.value.meta.parameters[0]
                                        }
                                        fieldValue={field}
                                        currentValue={field.function[1]}
                                        onChange={value => {
                                          const newFields = cloneDeep(fields);
                                          if (
                                            newFields[index]!.kind !==
                                            FieldValueKind.FUNCTION
                                          ) {
                                            return;
                                          }
                                          newFields[index]!.function[1] = value;
                                          dispatch({
                                            type: updateAction,
                                            payload: newFields,
                                          });
                                          setError?.({...error, queries: []});
                                        }}
                                      />
                                    )}
                                </Fragment>
                              )}
                            </FieldBar>
                            <FieldExtras
                              compact={
                                isTimeSeriesWidget ||
                                isBigNumberWidget ||
                                isCategoricalBarWidget ||
                                isHeatmapWidget
                              }
                            >
                              {canHaveAlias && (
                                <LegendAliasInput
                                  name="alias"
                                  placeholder={t('Add Alias')}
                                  value={field.alias ?? ''}
                                  disabled={disableTransactionWidget}
                                  onChange={e => {
                                    const newFields = cloneDeep(fields);
                                    newFields[index]!.alias = e.target.value;
                                    dispatch(
                                      {
                                        type: updateAction,
                                        payload: newFields,
                                      },
                                      {debounceUrl: true}
                                    );
                                  }}
                                  onBlur={e => {
                                    const newFields = cloneDeep(fields);
                                    newFields[index]!.alias = e.target.value;
                                    dispatch({
                                      type: updateAction,
                                      payload: newFields,
                                    });
                                    trackAnalytics(
                                      'dashboards_views.widget_builder.change',
                                      {
                                        builder_version: WidgetBuilderVersion.SLIDEOUT,
                                        field: 'visualize.legendAlias',
                                        from: source,
                                        new_widget: !isEditing,
                                        value: '',
                                        widget_type: state.dataset ?? '',
                                        organization,
                                      }
                                    );
                                  }}
                                />
                              )}
                              {(!isBigNumberWidget ||
                                datasetConfig.enableEquations ||
                                (isBigNumberWidget && fields.length > 1)) && (
                                <Button
                                  variant="transparent"
                                  icon={<IconDelete />}
                                  size="zero"
                                  disabled={
                                    fields.length <= 1 ||
                                    !canDelete ||
                                    isOnlyFieldOrAggregate
                                  }
                                  onClick={() => {
                                    dispatch({
                                      type: BuilderStateAction.DELETE_AGGREGATE,
                                      payload: index,
                                    });

                                    trackAnalytics(
                                      'dashboards_views.widget_builder.change',
                                      {
                                        builder_version: WidgetBuilderVersion.SLIDEOUT,
                                        field:
                                          field.kind === FieldValueKind.EQUATION
                                            ? 'visualize.deleteEquation'
                                            : 'visualize.deleteField',
                                        from: source,
                                        new_widget: !isEditing,
                                        value: '',
                                        widget_type: state.dataset ?? '',
                                        organization,
                                      }
                                    );
                                  }}
                                  aria-label={t('Remove field')}
                                />
                              )}
                            </FieldExtras>
                          </FieldRow>
                        )}
                      </SortableVisualizeFieldWrapper>
                    );
                  })}
                </Stack>
              </SortableContext>
              <DragOverlay
                dropAnimation={null}
                zIndex={theme.zIndex.modal}
                modifiers={[correctDragOverlayOffset]}
              >
                {activeId && (
                  <VisualizeGhostField
                    activeId={Number(activeId)}
                    aggregates={aggregates}
                    fields={fields ?? []}
                    isBigNumberWidget={isBigNumberWidget}
                    isTimeSeriesWidget={isTimeSeriesWidget}
                    stringFields={stringFields ?? []}
                  />
                )}
              </DragOverlay>
            </DndContext>
          </StyledFieldGroup>
          {canAddFields && (
            <Flex display="inline-flex" gap="lg">
              <AddButton
                variant="link"
                disabled={disableTransactionWidget || hasMaxMetrics}
                aria-label={
                  isTimeSeriesWidget
                    ? t('Add Series')
                    : isBigNumberWidget || isCategoricalBarWidget || isHeatmapWidget
                      ? t('Add Field')
                      : t('Add Column')
                }
                onClick={() => {
                  dispatch({
                    type: updateAction,
                    payload: [
                      ...(fields ?? []),
                      state.dataset === WidgetType.TRACEMETRICS && fields?.length
                        ? cloneDeep(fields?.[fields.length - 1]!)
                        : cloneDeep(defaultField),
                    ],
                  });

                  trackAnalytics('dashboards_views.widget_builder.change', {
                    builder_version: WidgetBuilderVersion.SLIDEOUT,
                    field: 'visualize.addField',
                    from: source,
                    new_widget: !isEditing,
                    value: '',
                    widget_type: state.dataset ?? '',
                    organization,
                  });
                }}
              >
                {isTimeSeriesWidget
                  ? t('+ Add Series')
                  : isBigNumberWidget || isCategoricalBarWidget || isHeatmapWidget
                    ? t('+ Add Field')
                    : t('+ Add Column')}
              </AddButton>
              {datasetConfig.enableEquations &&
                state.dataset !== WidgetType.TRACEMETRICS && (
                  <AddButton
                    variant="link"
                    disabled={disableTransactionWidget}
                    aria-label={t('Add Equation')}
                    onClick={() => {
                      dispatch({
                        type: updateAction,
                        payload: [
                          ...(fields ?? []),
                          {kind: FieldValueKind.EQUATION, field: ''},
                        ],
                      });

                      trackAnalytics('dashboards_views.widget_builder.change', {
                        builder_version: WidgetBuilderVersion.SLIDEOUT,
                        field: 'visualize.addEquation',
                        from: source,
                        new_widget: !isEditing,
                        value: '',
                        widget_type: state.dataset ?? '',
                        organization,
                      });
                    }}
                  >
                    {t('+ Add Equation')}
                  </AddButton>
                )}
            </Flex>
          )}
        </Fragment>
      )}
    </Fragment>
  );
}

const AddButton = styled(Button)`
  margin-top: ${p => p.theme.space.md};
`;

const StyledFieldGroup = styled(FieldGroup)`
  width: 100%;
  padding: 0px;
  border-bottom: none;
`;
