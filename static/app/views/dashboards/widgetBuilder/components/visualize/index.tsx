import {Fragment, useMemo, useState, type ReactNode} from 'react';
import {closestCenter, DndContext, DragOverlay} from '@dnd-kit/core';
import {arrayMove, SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {Button} from '@sentry/scraps/button';
import {CompactSelect, TriggerLabel} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';

import {openLinkToDashboardModal} from 'sentry/actionCreators/modal';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {IconDelete, IconLink} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {
  DEPRECATED_FIELDS,
  generateFieldAsString,
  parseFunction,
  type QueryFieldValue,
  type ValidateColumnTypes,
} from 'sentry/utils/discover/fields';
import {
  classifyTagKey,
  FieldKind,
  FieldValueType,
  prettifyTagKey,
} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {useHasDrillDownFlows} from 'sentry/views/dashboards/hooks/useHasDrillDownFlows';
import {
  DisplayType,
  WidgetType,
  type LinkedDashboard,
} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import SortableVisualizeFieldWrapper from 'sentry/views/dashboards/widgetBuilder/components/common/sortableFieldWrapper';
import {ExploreArithmeticBuilder} from 'sentry/views/dashboards/widgetBuilder/components/exploreArithmeticBuilder';
import {AggregateParameterField} from 'sentry/views/dashboards/widgetBuilder/components/visualize/aggregateParameterField';
import {
  ColumnCompactSelect,
  SelectRow,
} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
import {MetricSelectRow} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricSelectRow';
import VisualizeGhostField from 'sentry/views/dashboards/widgetBuilder/components/visualize/visualizeGhostField';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import {useDisableTransactionWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useDisableTransactionWidget';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {SESSIONS_TAGS} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import ArithmeticInput from 'sentry/views/discover/table/arithmeticInput';
import {validateColumnTypes} from 'sentry/views/discover/table/queryField';
import {FieldValueKind, type FieldValue} from 'sentry/views/discover/table/types';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';

export const NONE = 'none';

const NONE_AGGREGATE = {
  textValue: t('field'),
  label: tct('[emphasis:field]', {emphasis: <em />}),
  value: NONE,
  trailingItems: null,
};

function formatColumnOptions(
  dataset: WidgetType,
  options: Array<SelectValue<FieldValue>>,
  columnFilterMethod: (
    option: SelectValue<FieldValue>,
    field?: QueryFieldValue
  ) => boolean,
  field: QueryFieldValue
) {
  return options
    .filter(option => {
      // Don't show any aggregates under the columns
      return option.value.kind !== FieldValueKind.FUNCTION;
    })
    .map(option => {
      const supported = columnFilterMethod ? columnFilterMethod(option, field) : false;
      return {
        value: option.value.meta.name,
        label:
          dataset === WidgetType.SPANS || dataset === WidgetType.LOGS
            ? prettifyTagKey(option.value.meta.name)
            : option.value.meta.name,

        trailingItems: () => {
          return renderTag(
            option.value.kind,
            option.value.meta.name,
            option.value.kind !== FieldValueKind.FUNCTION &&
              option.value.kind !== FieldValueKind.EQUATION
              ? option.value.meta.dataType
              : undefined
          );
        },
        disabled: !supported,
        tooltip: ({disabled}: {disabled: boolean}) => {
          return disabled && field.kind === FieldValueKind.FUNCTION
            ? tct('This field is not available for the [aggregate] function', {
                aggregate: <strong>{field.function[0]}</strong>,
              })
            : undefined;
        },
      };
    });
}

function _sortFn(
  a: SelectValue<string> & {value: string; label?: string | ReactNode},
  b: SelectValue<string> & {value: string; label?: string | ReactNode}
) {
  // The labels should always be strings in this component, but we'll
  // handle the cases where they are not.
  if (typeof a.label !== 'string' || typeof b.label !== 'string') {
    return 0;
  }
  if (!defined(a.label) || !defined(b.label)) {
    return 0;
  }

  if (a.disabled && b.disabled) {
    return a.label.localeCompare(b.label);
  }
  if (a.disabled) {
    return 1;
  }
  if (b.disabled) {
    return -1;
  }

  return a.label.localeCompare(b.label);
}

export function getColumnOptions(
  dataset: WidgetType,
  selectedField: QueryFieldValue,
  fieldOptions: Record<string, SelectValue<FieldValue>>,
  columnFilterMethod: (
    option: SelectValue<FieldValue>,
    field?: QueryFieldValue
  ) => boolean,
  filterOutIncompatibleResults?: boolean
) {
  const fieldValues = Object.values(fieldOptions);
  if (
    selectedField.kind !== FieldValueKind.FUNCTION ||
    dataset === WidgetType.SPANS ||
    dataset === WidgetType.LOGS
  ) {
    return formatColumnOptions(dataset, fieldValues, columnFilterMethod, selectedField)
      .filter(option => (filterOutIncompatibleResults ? !option.disabled : true))
      .sort(_sortFn);
  }

  const fieldData = fieldValues.find(
    option => option.value.meta.name === selectedField.function[0]
  )?.value;

  if (
    fieldData &&
    fieldData.kind === FieldValueKind.FUNCTION &&
    fieldData.meta.parameters.length > 0 &&
    fieldData.meta.parameters[0]
  ) {
    const parameter = fieldData.meta.parameters[0];
    if (parameter && parameter.kind === 'dropdown') {
      // Parameters for dropdowns are already formatted in the correct manner
      // for select fields
      return parameter.options;
    }

    if (parameter && parameter.kind === 'column' && parameter.columnTypes) {
      // Release Health widgets are the only widgets that actually have different
      // columns than the aggregates accept. e.g. project will never be a valid
      // parameter for any of the aggregates.
      const allowedColumns =
        dataset === WidgetType.RELEASE
          ? fieldValues.filter(
              option =>
                option.value.kind === FieldValueKind.METRICS &&
                validateColumnTypes(
                  parameter.columnTypes as ValidateColumnTypes,
                  option.value
                )
            )
          : fieldValues;
      return formatColumnOptions(
        dataset,
        allowedColumns,
        (option, field) =>
          columnFilterMethod(option, field) &&
          (option.value.kind === FieldValueKind.FIELD ||
            option.value.kind === FieldValueKind.TAG ||
            option.value.kind === FieldValueKind.MEASUREMENT ||
            option.value.kind === FieldValueKind.CUSTOM_MEASUREMENT ||
            option.value.kind === FieldValueKind.METRICS ||
            option.value.kind === FieldValueKind.BREAKDOWN) &&
          validateColumnTypes(parameter.columnTypes as ValidateColumnTypes, option.value),
        selectedField
      ).sort(_sortFn);
    }
  }

  return formatColumnOptions(
    dataset,
    fieldValues,
    columnFilterMethod,
    selectedField
  ).sort(_sortFn);
}

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
  return true;
}

// Prefixes a value with `function:` because we need to ensure tags
// and functions do not overlap in value for the dropdowns
// Conflicting values seems to cause duplicate aggregate options
export function getAggregateValueKey(value: string | undefined) {
  if (!value) {
    return '';
  }

  return `function:${value}`;
}

// When we set the aggregate, we need to split out the function prefix
export function parseAggregateFromValueKey(value: string) {
  if (!value.startsWith('function:')) {
    return value;
  }

  return value.split(':')[1];
}

interface VisualizeProps {
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
}

function Visualize({error, setError}: VisualizeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();
  const tags = useTags();
  const {customMeasurements} = useCustomMeasurements();
  const {selectedAggregate: queryParamSelectedAggregate} = useLocationQuery({
    fields: {selectedAggregate: decodeScalar},
  });
  const [selectedAggregateSet, setSelectedAggregateSet] = useState(
    defined(queryParamSelectedAggregate)
  );
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();
  const disableTransactionWidget = useDisableTransactionWidget();

  const isTimeSeriesWidget = usesTimeSeriesData(state.displayType);
  const isBigNumberWidget = state.displayType === DisplayType.BIG_NUMBER;
  const isTableWidget = state.displayType === DisplayType.TABLE;
  const isCategoricalBarWidget = state.displayType === DisplayType.CATEGORICAL_BAR;

  let hiddenKeys: string[] = [];
  if (state.dataset === WidgetType.TRACEMETRICS) {
    hiddenKeys = HiddenTraceMetricSearchFields;
  }
  const {tags: numericSpanTags} = useTraceItemTags('number', hiddenKeys);
  const {tags: stringSpanTags} = useTraceItemTags('string', hiddenKeys);
  const {tags: booleanSpanTags} = useTraceItemTags('boolean', hiddenKeys);

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
            !stringSpanTags.hasOwnProperty(column) &&
            !numericSpanTags.hasOwnProperty(column) &&
            !booleanSpanTags.hasOwnProperty(column)
        )
        .map(column => {
          return {
            label: prettifyTagKey(column),
            value: column,
            trailingItems: () => <TypeBadge kind={classifyTagKey(column)} />,
          };
        }),
      ...Object.values(booleanSpanTags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          trailingItems: () => <TypeBadge kind={FieldKind.BOOLEAN} />,
        };
      }),
      ...Object.values(stringSpanTags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          trailingItems: () => <TypeBadge kind={FieldKind.TAG} />,
        };
      }),
      ...Object.values(numericSpanTags).map(tag => {
        return {
          label: prettifyTagKey(tag.name),
          value: tag.key,
          trailingItems: () => <TypeBadge kind={FieldKind.MEASUREMENT} />,
        };
      }),
    ];
    options.sort(_sortFn);
    return options;
  }, [state.dataset, state.fields, stringSpanTags, numericSpanTags, booleanSpanTags]);

  const datasetConfig = useMemo(() => getDatasetConfig(state.dataset), [state.dataset]);

  // Determines which state field stores the visualization fields:

  // - Line, Area, Bar (Time Series): use state.yAxis for aggregates
  // - Table, Big Number: use state.fields for all columns (fields + aggregates)
  // - Bar (Categorical): Use exactly two state.fields. One is of `function` type, configured here.
  //   the other is of `field` type and configured in the X axis selector.
  const usesYAxisState = isTimeSeriesWidget && !isCategoricalBarWidget;
  const allFields = usesYAxisState ? state.yAxis : state.fields;
  // For categorical bars, only show aggregate fields (FUNCTION kind) in the
  // Visualize section. There should be exactly one in the state. The X-axis
  // field (FIELD kind) is managed separately in the X-Axis selector
  const aggregateFields = isCategoricalBarWidget
    ? allFields?.filter(f => f.kind === FieldValueKind.FUNCTION)
    : null;

  const fields = isCategoricalBarWidget
    ? aggregateFields
    : usesYAxisState
      ? state.yAxis
      : state.fields;

  const canHaveAlias =
    !isTimeSeriesWidget && !isBigNumberWidget && !isCategoricalBarWidget;

  // Determines whether "Add Series/Column/Equation" buttons are shown:
  // - Line, Area, Bar (Time Series): Can add multiple Y-axis series
  // - Table: Can add multiple columns
  // - Big Number: Can add fields only if equations are enabled for the dataset
  // - Bar (Categorical): Can add one aggregate if none exists yet
  const canAddFields =
    (isCategoricalBarWidget && (!aggregateFields || aggregateFields.length === 0)) ||
    (!isCategoricalBarWidget &&
      (isTimeSeriesWidget ||
        isTableWidget ||
        (isBigNumberWidget && datasetConfig.enableEquations)));
  const linkedDashboards = state.linkedDashboards || [];

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
      ? t('Primary metric that appears in your chart.')
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

  const fieldErrors = error?.queries?.find(
    (queryError: any) => queryError?.fields
  )?.fields;
  const aggregateErrors = error?.queries?.find(
    (aggregateError: any) => aggregateError?.aggregates
  )?.aggregates;

  const canDrag =
    fields?.length && fields.length > 1 && state.displayType !== DisplayType.BIG_NUMBER;

  const draggableFieldIds = fields?.map((_field, index) => index.toString()) ?? [];

  const hasExploreEquations = organization.features.includes(
    'visibility-explore-equations'
  );
  const hasDrillDownFlows = useHasDrillDownFlows();

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
    if (isTimeSeriesWidget || isBigNumberWidget) {
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
    state.dataset,
    baseAggregateOptions,
    traceItemColumnOptions,
    releaseSessionTagsOptions,
    tableFieldOptions,
  ]);

  return (
    <Fragment>
      <SectionHeader
        title={isTableWidget ? t('Columns') : t('Visualize')}
        tooltipText={tooltipText}
      />
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
                  fields.some(fieldItem => fieldItem.kind === FieldValueKind.EQUATION) &&
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
                  matchingAggregate = aggregates.find(
                    option =>
                      option.value.meta.name ===
                      parseFunction(stringFields?.[index] ?? '')?.name
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
                          state.displayType === DisplayType.BIG_NUMBER && (
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
                                  setSelectedAggregateSet(true);
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
                                  disabled={disableTransactionWidget}
                                  field={field}
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
                                        newFields[index]!.kind !== FieldValueKind.FUNCTION
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
                            isCategoricalBarWidget
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
                                  {updateUrl: false}
                                );
                              }}
                              onBlur={e => {
                                const newFields = cloneDeep(fields);
                                newFields[index]!.alias = e.target.value;
                                dispatch(
                                  {
                                    type: updateAction,
                                    payload: newFields,
                                  },
                                  {updateUrl: true}
                                );
                                trackAnalytics('dashboards_views.widget_builder.change', {
                                  builder_version: WidgetBuilderVersion.SLIDEOUT,
                                  field: 'visualize.legendAlias',
                                  from: source,
                                  new_widget: !isEditing,
                                  value: '',
                                  widget_type: state.dataset ?? '',
                                  organization,
                                });
                              }}
                            />
                          )}
                          {hasDrillDownFlows &&
                            isTableWidget &&
                            fields[index]?.kind === FieldValueKind.FIELD && (
                              <Button
                                priority="transparent"
                                icon={<IconLink />}
                                aria-label={t('Link field')}
                                size="zero"
                                onClick={() => {
                                  openLinkToDashboardModal({
                                    onLink: dashboardId => {
                                      if (
                                        fields[index]?.kind === FieldValueKind.FIELD &&
                                        fields[index]?.field
                                      ) {
                                        const newLinkedDashboards: LinkedDashboard[] = [
                                          ...linkedDashboards,
                                          {dashboardId, field: fields[index].field},
                                        ];
                                        dispatch({
                                          type: BuilderStateAction.SET_LINKED_DASHBOARDS,
                                          payload: newLinkedDashboards,
                                        });
                                      }
                                    },
                                    currentLinkedDashboard: linkedDashboards.find(
                                      linkedDashboard => {
                                        if (
                                          fields[index]?.kind === FieldValueKind.FIELD &&
                                          fields[index]?.field
                                        ) {
                                          return (
                                            linkedDashboard.field === fields[index].field
                                          );
                                        }
                                        return false;
                                      }
                                    ),
                                    source,
                                  });
                                }}
                              />
                            )}
                          {(state.displayType !== DisplayType.BIG_NUMBER ||
                            datasetConfig.enableEquations) && (
                            <Button
                              priority="transparent"
                              icon={<IconDelete />}
                              size="zero"
                              disabled={
                                fields.length <= 1 || !canDelete || isOnlyFieldOrAggregate
                              }
                              onClick={() => {
                                dispatch({
                                  type: updateAction,
                                  payload:
                                    fields?.filter((_field, i) => i !== index) ?? [],
                                });

                                if (
                                  state.displayType === DisplayType.BIG_NUMBER &&
                                  selectedAggregateSet
                                ) {
                                  // Unset the selected aggregate if it's the last one
                                  // so the state will automatically choose the last aggregate
                                  // as new fields are added
                                  if (state.selectedAggregate === fields.length - 1) {
                                    dispatch({
                                      type: BuilderStateAction.SET_SELECTED_AGGREGATE,
                                      payload: undefined,
                                    });
                                  }
                                }

                                trackAnalytics('dashboards_views.widget_builder.change', {
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
                                });
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
          <DragOverlay dropAnimation={null}>
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
        <AddButtons>
          <AddButton
            priority="link"
            disabled={disableTransactionWidget}
            aria-label={
              isTimeSeriesWidget
                ? t('Add Series')
                : isBigNumberWidget
                  ? t('Add Field')
                  : t('Add Column')
            }
            onClick={() => {
              dispatch({
                type: updateAction,
                payload: [...(fields ?? []), cloneDeep(defaultField)],
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
              : isBigNumberWidget
                ? t('+ Add Field')
                : t('+ Add Column')}
          </AddButton>
          {datasetConfig.enableEquations &&
            (state.dataset !== WidgetType.SPANS ||
              (state.dataset === WidgetType.SPANS && hasExploreEquations)) && (
              <AddButton
                priority="link"
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
        </AddButtons>
      )}
    </Fragment>
  );
}

export default Visualize;

function renderTag(kind: FieldValueKind, label: string, dataType?: string) {
  return (
    <TypeBadge
      label={label}
      valueKind={kind}
      valueType={dataType as FieldValueType}
      deprecatedFields={DEPRECATED_FIELDS}
    />
  );
}

export const AggregateCompactSelect = styled(CompactSelect)<{
  hasColumnParameter: boolean;
}>`
  ${p =>
    p.hasColumnParameter
      ? css`
          width: fit-content;
          left: 1px;

          ${TriggerLabel} {
            overflow: visible;
          }
        `
      : css`
          width: 100%;
        `}

  > button {
    width: 100%;
  }
`;

export const LegendAliasInput = styled(Input)``;

export const ParameterRefinements = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};

  > * {
    flex: 1;
  }
`;

export const FieldBar = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(1)};
  flex: 3;
  min-width: 0;
`;

export const PrimarySelectRow = styled('div')<{
  hasColumnParameter: boolean;
}>`
  display: flex;
  width: 100%;
  min-width: 0;

  & ${ColumnCompactSelect} button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  & ${AggregateCompactSelect} button {
    ${p =>
      p.hasColumnParameter &&
      css`
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      `}
  }
`;

export function FieldRow(props: FlexProps<'div'>) {
  return <Flex gap="md" width="100%" minWidth="0" {...props} />;
}

export const FieldExtras = styled('div')<{compact: boolean}>`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  flex: ${p => (p.compact ? '0' : '1')};
  align-items: center;
`;

const AddButton = styled(Button)`
  margin-top: ${space(1)};
`;

const AddButtons = styled('div')`
  display: inline-flex;
  gap: ${space(1.5)};
`;

export const StyledArithmeticInput = styled(ArithmeticInput)`
  width: 100%;
`;

const StyledFieldGroup = styled(FieldGroup)`
  width: 100%;
  padding: 0px;
  border-bottom: none;
`;
