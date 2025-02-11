import {Fragment, useMemo, useState} from 'react';
import {closestCenter, DndContext, DragOverlay} from '@dnd-kit/core';
import {arrayMove, SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import BaseTag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {TriggerLabel} from 'sentry/components/compactSelect/control';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Input from 'sentry/components/input';
import Radio from 'sentry/components/radio';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {
  type AggregateParameter,
  type AggregationKeyWithAlias,
  type AggregationRefinement,
  classifyTagKey,
  DEPRECATED_FIELDS,
  generateFieldAsString,
  parseFunction,
  prettifyTagKey,
  type QueryFieldValue,
  type ValidateColumnTypes,
} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useApi from 'sentry/utils/useApi';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import SortableVisualizeFieldWrapper from 'sentry/views/dashboards/widgetBuilder/components/common/sortableFieldWrapper';
import {AggregateParameterField} from 'sentry/views/dashboards/widgetBuilder/components/visualize/aggregateParameterField';
import VisualizeGhostField from 'sentry/views/dashboards/widgetBuilder/components/visualize/visualizeGhostField';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {SESSIONS_TAGS} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import ArithmeticInput from 'sentry/views/discover/table/arithmeticInput';
import {validateColumnTypes} from 'sentry/views/discover/table/queryField';
import {type FieldValue, FieldValueKind} from 'sentry/views/discover/table/types';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

type AggregateFunction = [
  AggregationKeyWithAlias,
  string,
  AggregationRefinement,
  AggregationRefinement,
];

const MAX_FUNCTION_PARAMETERS = 4;
const NONE = 'none';

const NONE_AGGREGATE = {
  textValue: t('field (no aggregate)'),
  label: tct('[emphasis:field (no aggregate)]', {
    emphasis: <em />,
  }),
  value: NONE,
  trailingItems: null,
};

function formatColumnOptions(
  dataset: WidgetType,
  options: Array<SelectValue<FieldValue>>,
  columnFilterMethod: (
    option: SelectValue<FieldValue>,
    field?: QueryFieldValue
  ) => boolean
) {
  return options
    .filter(option => {
      // Don't show any aggregates under the columns, and if
      // there isn't a filter method, just show the option
      return (
        option.value.kind !== FieldValueKind.FUNCTION &&
        (columnFilterMethod?.(option) ?? true)
      );
    })
    .map(option => ({
      value: option.value.meta.name,
      label:
        dataset === WidgetType.SPANS
          ? prettifyTagKey(option.value.meta.name)
          : option.value.meta.name,

      // For the spans dataset, all of the options are measurements,
      // so we force the number badge to show
      trailingItems:
        dataset === WidgetType.SPANS ? (
          <TypeBadge kind={FieldKind.MEASUREMENT} />
        ) : (
          renderTag(option.value.kind, option.value.meta.name)
        ),
    }));
}

function getColumnOptions(
  dataset: WidgetType,
  selectedField: QueryFieldValue,
  fieldOptions: Record<string, SelectValue<FieldValue>>,
  columnFilterMethod: (
    option: SelectValue<FieldValue>,
    field?: QueryFieldValue
  ) => boolean
) {
  const fieldValues = Object.values(fieldOptions);
  if (selectedField.kind !== FieldValueKind.FUNCTION || dataset === WidgetType.SPANS) {
    return formatColumnOptions(dataset, fieldValues, columnFilterMethod);
  }

  const field = fieldValues.find(
    option => option.value.meta.name === selectedField.function[0]
  )?.value;

  if (
    field &&
    field.kind === FieldValueKind.FUNCTION &&
    field.meta.parameters.length > 0 &&
    field.meta.parameters[0]
  ) {
    const parameter = field.meta.parameters[0];
    if (parameter && parameter.kind === 'dropdown') {
      // Parameters for dropdowns are already formatted in the correct manner
      // for select fields
      return parameter.options;
    }

    if (parameter && parameter.kind === 'column' && parameter.columnTypes) {
      return formatColumnOptions(
        dataset,
        fieldValues.filter(({value}) =>
          dataset === WidgetType.RELEASE
            ? value.kind === FieldValueKind.METRICS &&
              validateColumnTypes(parameter.columnTypes as ValidateColumnTypes, value)
            : value.kind === FieldValueKind.FIELD ||
              value.kind === FieldValueKind.TAG ||
              value.kind === FieldValueKind.MEASUREMENT ||
              value.kind === FieldValueKind.CUSTOM_MEASUREMENT ||
              value.kind === FieldValueKind.METRICS ||
              (value.kind === FieldValueKind.BREAKDOWN &&
                validateColumnTypes(parameter.columnTypes as ValidateColumnTypes, value))
        ),
        columnFilterMethod
      );
    }
  }

  return formatColumnOptions(dataset, fieldValues, columnFilterMethod);
}

function validateParameter(
  columnOptions: Array<SelectValue<string>>,
  parameter: AggregateParameter,
  value: string | undefined
) {
  if (parameter.kind === 'dropdown') {
    return Boolean(parameter.options.find(option => option.value === value)?.value);
  }
  if (parameter.kind === 'column') {
    return Boolean(columnOptions.find(option => option.value === value)?.value);
  }
  if (parameter.kind === 'value') {
    if (parameter.dataType === 'number') {
      return !isNaN(Number(value));
    }
    return true;
  }
  return false;
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

interface VisualizeProps {
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
}

function Visualize({error, setError}: VisualizeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const organization = useOrganization();
  const api = useApi();
  const {state, dispatch} = useWidgetBuilderContext();
  let tags = useTags();
  const {customMeasurements} = useCustomMeasurements();
  const {selectedAggregate: queryParamSelectedAggregate} = useLocationQuery({
    fields: {
      selectedAggregate: decodeScalar,
    },
  });
  const [selectedAggregateSet, setSelectedAggregateSet] = useState(
    defined(queryParamSelectedAggregate)
  );
  const source = useDashboardWidgetSource();
  const isEditing = useIsEditingWidget();

  const isChartWidget =
    state.displayType !== DisplayType.TABLE &&
    state.displayType !== DisplayType.BIG_NUMBER;
  const isBigNumberWidget = state.displayType === DisplayType.BIG_NUMBER;
  const numericSpanTags = useSpanTags('number');
  const stringSpanTags = useSpanTags('string');

  // Span column options are explicitly defined and bypass all of the
  // fieldOptions filtering and logic used for showing options for
  // chart types.
  let spanColumnOptions: Array<SelectValue<string> & {label: string; value: string}>;
  if (state.dataset === WidgetType.SPANS) {
    // Explicitly merge numeric and string tags to ensure filtering
    // compatibility for timeseries chart types.
    tags = {...numericSpanTags, ...stringSpanTags};

    const columns =
      state.fields
        ?.filter(field => field.kind === FieldValueKind.FIELD)
        .map(field => field.field) ?? [];
    spanColumnOptions = [
      // Columns that are not in the tag responses, e.g. old tags
      ...columns
        .filter(
          column =>
            column !== '' &&
            !stringSpanTags.hasOwnProperty(column) &&
            !numericSpanTags.hasOwnProperty(column)
        )
        .map(column => {
          return {
            label: prettifyTagKey(column),
            value: column,
            textValue: column,
            trailingItems: <TypeBadge kind={classifyTagKey(column)} />,
          };
        }),
      ...Object.values(stringSpanTags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          textValue: tag.name,
          trailingItems: <TypeBadge kind={FieldKind.TAG} />,
        };
      }),
      ...Object.values(numericSpanTags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          textValue: tag.name,
          trailingItems: <TypeBadge kind={FieldKind.MEASUREMENT} />,
        };
      }),
    ];
    spanColumnOptions.sort((a, b) => {
      if (a.label < b.label) {
        return -1;
      }

      if (a.label > b.label) {
        return 1;
      }

      return 0;
    });
  }

  const datasetConfig = useMemo(() => getDatasetConfig(state.dataset), [state.dataset]);

  const fields = isChartWidget ? state.yAxis : state.fields;
  const updateAction = isChartWidget
    ? BuilderStateAction.SET_Y_AXIS
    : BuilderStateAction.SET_FIELDS;

  const fieldOptions = useMemo(
    () => datasetConfig.getTableFieldOptions(organization, tags, customMeasurements),
    [organization, tags, customMeasurements, datasetConfig]
  );

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

  return (
    <Fragment>
      <SectionHeader
        title={t('Visualize')}
        tooltipText={t(
          'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
        )}
      />
      <StyledFieldGroup
        error={isChartWidget ? aggregateErrors : fieldErrors}
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
            <Fields>
              {fields?.map((field, index) => {
                const canDelete = canDeleteField(
                  state.dataset ?? WidgetType.ERRORS,
                  fields,
                  field
                );

                const isOnlyFieldOrAggregate =
                  fields.length === 2 &&
                  field.kind !== FieldValueKind.EQUATION &&
                  fields.filter(fieldItem => fieldItem.kind === FieldValueKind.EQUATION)
                    .length > 0;

                // Depending on the dataset and the display type, we use different options for
                // displaying in the column select.
                // For charts, we show aggregate parameter options for the y-axis as primary options.
                // For tables, we show all string tags and fields as primary options, as well
                // as aggregates that don't take parameters.
                const columnFilterMethod = isChartWidget
                  ? datasetConfig.filterYAxisAggregateParams?.(
                      field,
                      state.displayType ?? DisplayType.LINE
                    )
                  : field.kind === FieldValueKind.FUNCTION
                    ? datasetConfig.filterAggregateParams
                    : datasetConfig.filterTableOptions;
                const columnOptions = getColumnOptions(
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
                > = aggregates.map(option => ({
                  value: option.value.meta.name,
                  label: option.value.meta.name,
                  trailingItems:
                    renderTag(option.value.kind, option.value.meta.name) ?? null,
                }));

                if (!isChartWidget && !isBigNumberWidget) {
                  const baseOptions = [NONE_AGGREGATE, ...aggregateOptions];

                  if (state.dataset === WidgetType.ISSUE) {
                    // Issue widgets don't have aggregates, set to baseOptions to include the NONE_AGGREGATE label
                    aggregateOptions = baseOptions;
                  } else if (state.dataset === WidgetType.SPANS) {
                    // Add span column options for Spans dataset
                    aggregateOptions = [...baseOptions, ...spanColumnOptions];
                  } else if (state.dataset === WidgetType.RELEASE) {
                    aggregateOptions = [
                      ...(canDelete ? baseOptions : aggregateOptions),
                      ...Object.values(fieldOptions)
                        // release dataset tables only use specific fields "SESSION_TAGS"
                        .filter(option => SESSIONS_TAGS.includes(option.value.meta.name))
                        .map(option => ({
                          label: option.value.meta.name,
                          value: option.value.meta.name,
                          textValue: option.value.meta.name,
                          trailingItems: renderTag(
                            option.value.kind,
                            option.value.meta.name
                          ),
                        })),
                    ];
                  } else {
                    // Add column options to the aggregate dropdown for non-Issue and non-Spans datasets
                    aggregateOptions = [
                      ...baseOptions,

                      // Iterate over fieldOptions so we can show all of the fields without any filtering
                      // imposed by the aggregate filtering its possible columns
                      ...Object.values(fieldOptions)
                        .filter(option => option.value.kind !== FieldValueKind.FUNCTION)
                        .map(option => ({
                          label: option.value.meta.name,
                          value: option.value.meta.name,
                          textValue: option.value.meta.name,
                          trailingItems: renderTag(
                            option.value.kind,
                            option.value.meta.name
                          ),
                        })),
                    ];
                  }
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
                        <FieldBar data-testid={'field-bar'}>
                          {field.kind === FieldValueKind.EQUATION ? (
                            <StyledArithmeticInput
                              name="arithmetic"
                              key="parameter:text"
                              type="text"
                              required
                              value={field.field}
                              onUpdate={value => {
                                dispatch({
                                  type: updateAction,
                                  payload: fields.map((_field, i) =>
                                    i === index ? {..._field, field: value} : _field
                                  ),
                                });
                                setError?.({...error, queries: []});
                                trackAnalytics('dashboards_views.widget_builder.change', {
                                  builder_version: WidgetBuilderVersion.SLIDEOUT,
                                  field: 'visualize.updateEquation',
                                  from: source,
                                  new_widget: !isEditing,
                                  value: '',
                                  widget_type: state.dataset ?? '',
                                  organization,
                                });
                              }}
                              options={fields}
                              placeholder={t('Equation')}
                              aria-label={t('Equation')}
                            />
                          ) : (
                            <Fragment>
                              <PrimarySelectRow hasColumnParameter={hasColumnParameter}>
                                <AggregateCompactSelect
                                  searchable
                                  hasColumnParameter={hasColumnParameter}
                                  disabled={aggregateOptions.length <= 1}
                                  options={aggregateOptions}
                                  value={
                                    parseFunction(stringFields?.[index] ?? '')?.name ??
                                    NONE
                                  }
                                  position="bottom-start"
                                  onChange={dropdownSelection => {
                                    const isNone = dropdownSelection.value === NONE;
                                    let newFields = cloneDeep(fields);
                                    const currentField = newFields[index]!;
                                    const selectedAggregate = aggregates.find(
                                      option =>
                                        option.value.meta.name === dropdownSelection.value
                                    );
                                    // Update the current field's aggregate with the new aggregate
                                    if (!selectedAggregate && !isNone) {
                                      const functionFields = newFields.filter(
                                        newField =>
                                          newField.kind === FieldValueKind.FUNCTION
                                      );
                                      // Handles selection of release tags from aggregate dropdown
                                      if (
                                        state.dataset === WidgetType.RELEASE &&
                                        state.displayType === DisplayType.TABLE &&
                                        functionFields.length === 1
                                      ) {
                                        newFields = [
                                          {
                                            kind: FieldValueKind.FIELD,
                                            field: dropdownSelection.value as string,
                                          },
                                          ...newFields,
                                        ];

                                        const atLeastOneFunction = newFields.some(
                                          newField =>
                                            newField.kind === FieldValueKind.FUNCTION
                                        );

                                        // add a function in the off chance the user gets into a state where
                                        // they don't already have a function there
                                        if (!atLeastOneFunction) {
                                          newFields = [
                                            ...newFields,
                                            datasetConfig.defaultField,
                                          ];
                                        }
                                      } else {
                                        // Handles new selection of a field from the aggregate dropdown
                                        newFields[index] = {
                                          kind: FieldValueKind.FIELD,
                                          field: dropdownSelection.value as string,
                                        };
                                      }
                                      trackAnalytics(
                                        'dashboards_views.widget_builder.change',
                                        {
                                          builder_version: WidgetBuilderVersion.SLIDEOUT,
                                          field: 'visualize.updateAggregate',
                                          from: source,
                                          new_widget: !isEditing,
                                          value: 'direct_column',
                                          widget_type: state.dataset ?? '',
                                          organization,
                                        }
                                      );
                                    } else if (!isNone) {
                                      if (currentField.kind === FieldValueKind.FUNCTION) {
                                        // Handle setting an aggregate from an aggregate
                                        currentField.function[0] =
                                          dropdownSelection.value as AggregationKeyWithAlias;
                                        if (
                                          selectedAggregate?.value.meta &&
                                          'parameters' in selectedAggregate.value.meta
                                        ) {
                                          // There are aggregates that have no parameters, so wipe out the argument
                                          // if it's supposed to be empty
                                          if (
                                            selectedAggregate.value.meta.parameters
                                              .length === 0
                                          ) {
                                            currentField.function[1] = '';
                                          } else {
                                            // Check if the column is a valid column for the new aggregate
                                            const newColumnOptions = getColumnOptions(
                                              state.dataset ?? WidgetType.ERRORS,
                                              currentField,
                                              fieldOptions,
                                              // If no column filter method is provided, show all options
                                              columnFilterMethod ?? (() => true)
                                            );
                                            const selectedAggregateIsApdexOrUserMisery =
                                              selectedAggregate?.value.meta.name ===
                                                'apdex' ||
                                              selectedAggregate?.value.meta.name ===
                                                'user_misery';
                                            const isValidColumn =
                                              !selectedAggregateIsApdexOrUserMisery &&
                                              Boolean(
                                                newColumnOptions.find(
                                                  option =>
                                                    option.value ===
                                                    currentField.function[1]
                                                )?.value
                                              );
                                            currentField.function[1] =
                                              (isValidColumn
                                                ? currentField.function[1]
                                                : selectedAggregate.value.meta
                                                    .parameters[0]!.defaultValue) ?? '';

                                            // Set the remaining parameters for the new aggregate
                                            for (
                                              let i = 1; // The first parameter is the column selection
                                              i <
                                              selectedAggregate.value.meta.parameters
                                                .length;
                                              i++
                                            ) {
                                              // Increment by 1 to skip past the aggregate name
                                              currentField.function[i + 1] =
                                                selectedAggregate.value.meta.parameters[
                                                  i
                                                ]!.defaultValue;
                                            }
                                          }

                                          // Wipe out the remaining parameters that are unnecessary
                                          // This is necessary for transitioning between aggregates that have
                                          // more parameters to ones of fewer parameters
                                          for (
                                            let i =
                                              selectedAggregate.value.meta.parameters
                                                .length;
                                            i < MAX_FUNCTION_PARAMETERS;
                                            i++
                                          ) {
                                            currentField.function[i + 1] = undefined;
                                          }
                                        }
                                      } else {
                                        if (
                                          !selectedAggregate ||
                                          !('parameters' in selectedAggregate.value.meta)
                                        ) {
                                          return;
                                        }

                                        // Handle setting an aggregate from a field
                                        const newFunction: AggregateFunction = [
                                          dropdownSelection.value as AggregationKeyWithAlias,
                                          ((selectedAggregate?.value.meta?.parameters
                                            .length > 0 &&
                                            currentField.field) ||
                                            selectedAggregate?.value.meta?.parameters?.[0]
                                              ?.defaultValue) ??
                                            '',
                                          selectedAggregate?.value.meta?.parameters?.[1]
                                            ?.defaultValue ?? undefined,
                                          selectedAggregate?.value.meta?.parameters?.[2]
                                            ?.defaultValue ?? undefined,
                                        ];
                                        const newColumnOptions = getColumnOptions(
                                          state.dataset ?? WidgetType.ERRORS,
                                          {
                                            kind: FieldValueKind.FUNCTION,
                                            function: newFunction,
                                          },
                                          fieldOptions,
                                          // If no column filter method is provided, show all options
                                          columnFilterMethod ?? (() => true)
                                        );
                                        if (
                                          selectedAggregate?.value.meta &&
                                          'parameters' in selectedAggregate.value.meta
                                        ) {
                                          selectedAggregate?.value.meta.parameters.forEach(
                                            (parameter, parameterIndex) => {
                                              const isValidParameter = validateParameter(
                                                newColumnOptions,
                                                parameter,
                                                newFunction[parameterIndex + 1]
                                              );
                                              // Increment by 1 to skip past the aggregate name
                                              newFunction[parameterIndex + 1] =
                                                (isValidParameter
                                                  ? newFunction[parameterIndex + 1]
                                                  : parameter.defaultValue) ?? '';
                                            }
                                          );
                                        }
                                        newFields[index] = {
                                          kind: FieldValueKind.FUNCTION,
                                          function: newFunction,
                                        };
                                      }
                                      trackAnalytics(
                                        'dashboards_views.widget_builder.change',
                                        {
                                          builder_version: WidgetBuilderVersion.SLIDEOUT,
                                          field: 'visualize.updateAggregate',
                                          from: source,
                                          new_widget: !isEditing,
                                          value: 'aggregate',
                                          widget_type: state.dataset ?? '',
                                          organization,
                                        }
                                      );
                                    } else {
                                      // Handle selecting NONE so we can select just a field, e.g. for samples
                                      // If NONE is selected, set the field to a field value

                                      // When selecting NONE, the next possible columns may be different from the
                                      // possible columns for the previous aggregate. Calculate the valid columns,
                                      // see if the current field's function argument is in the valid columns, and if so,
                                      // set the field to a field value. Otherwise, set the field to the first valid column.
                                      const validColumnFields = Object.values(
                                        datasetConfig.getTableFieldOptions?.(
                                          organization,
                                          tags,
                                          customMeasurements,
                                          api
                                        ) ?? []
                                      ).filter(
                                        option =>
                                          option.value.kind !== FieldValueKind.FUNCTION &&
                                          (datasetConfig.filterTableOptions?.(option) ??
                                            true)
                                      );
                                      const functionArgInValidColumnFields =
                                        ('function' in currentField &&
                                          validColumnFields.find(
                                            option =>
                                              option.value.meta.name ===
                                              currentField.function[1]
                                          )) ||
                                        undefined;
                                      const validColumn =
                                        functionArgInValidColumnFields?.value.meta.name ??
                                        validColumnFields?.[0]?.value.meta.name ??
                                        '';
                                      newFields[index] = {
                                        kind: FieldValueKind.FIELD,
                                        field: validColumn,
                                      };

                                      trackAnalytics(
                                        'dashboards_views.widget_builder.change',
                                        {
                                          builder_version: WidgetBuilderVersion.SLIDEOUT,
                                          field: 'visualize.updateAggregate',
                                          from: source,
                                          new_widget: !isEditing,
                                          value: 'column',
                                          widget_type: state.dataset ?? '',
                                          organization,
                                        }
                                      );
                                    }
                                    dispatch({
                                      type: updateAction,
                                      payload: newFields,
                                    });
                                    setError?.({...error, queries: []});
                                  }}
                                  triggerProps={{
                                    'aria-label': t('Aggregate Selection'),
                                  }}
                                />
                                {hasColumnParameter && (
                                  <ColumnCompactSelect
                                    searchable
                                    position="bottom-start"
                                    options={
                                      state.dataset === WidgetType.SPANS &&
                                      field.kind !== FieldValueKind.FUNCTION
                                        ? spanColumnOptions
                                        : columnOptions
                                    }
                                    value={
                                      field.kind === FieldValueKind.FUNCTION
                                        ? parseFunction(stringFields?.[index] ?? '')
                                            ?.arguments[0] ?? ''
                                        : field.field
                                    }
                                    onChange={newField => {
                                      const newFields = cloneDeep(fields);
                                      const currentField = newFields[index]!;
                                      // Update the current field's aggregate with the new aggregate
                                      if (currentField.kind === FieldValueKind.FUNCTION) {
                                        currentField.function[1] =
                                          newField.value as string;
                                      }
                                      if (currentField.kind === FieldValueKind.FIELD) {
                                        currentField.field = newField.value as string;
                                      }
                                      dispatch({
                                        type: updateAction,
                                        payload: newFields,
                                      });
                                      setError?.({...error, queries: []});
                                      trackAnalytics(
                                        'dashboards_views.widget_builder.change',
                                        {
                                          builder_version: WidgetBuilderVersion.SLIDEOUT,
                                          field: 'visualize.updateColumn',
                                          from: source,
                                          new_widget: !isEditing,
                                          value:
                                            currentField.kind === FieldValueKind.FIELD
                                              ? 'column'
                                              : 'aggregate',
                                          widget_type: state.dataset ?? '',
                                          organization,
                                        }
                                      );
                                    }}
                                    triggerProps={{
                                      'aria-label': t('Column Selection'),
                                    }}
                                  />
                                )}
                              </PrimarySelectRow>
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
                        <FieldExtras isChartWidget={isChartWidget || isBigNumberWidget}>
                          {!isChartWidget && !isBigNumberWidget && (
                            <LegendAliasInput
                              type="text"
                              name="name"
                              placeholder={t('Add Alias')}
                              value={field.alias ?? ''}
                              onChange={e => {
                                const newFields = cloneDeep(fields);
                                newFields[index]!.alias = e.target.value;
                                dispatch({
                                  type: updateAction,
                                  payload: newFields,
                                });
                              }}
                              onBlur={() => {
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
                          <StyledDeleteButton
                            borderless
                            icon={<IconDelete />}
                            size="zero"
                            disabled={
                              fields.length <= 1 || !canDelete || isOnlyFieldOrAggregate
                            }
                            onClick={() => {
                              dispatch({
                                type: updateAction,
                                payload: fields?.filter((_field, i) => i !== index) ?? [],
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
                        </FieldExtras>
                      </FieldRow>
                    )}
                  </SortableVisualizeFieldWrapper>
                );
              })}
            </Fields>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeId && (
              <VisualizeGhostField
                activeId={Number(activeId)}
                aggregates={aggregates}
                fields={fields ?? []}
                isBigNumberWidget={isBigNumberWidget}
                isChartWidget={isChartWidget}
                stringFields={stringFields ?? []}
              />
            )}
          </DragOverlay>
        </DndContext>
      </StyledFieldGroup>

      <AddButtons>
        <AddButton
          priority="link"
          aria-label={isChartWidget ? t('Add Series') : t('Add Field')}
          onClick={() => {
            dispatch({
              type: updateAction,
              payload: [...(fields ?? []), cloneDeep(datasetConfig.defaultField)],
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
          {isChartWidget ? t('+ Add Series') : t('+ Add Field')}
        </AddButton>
        {datasetConfig.enableEquations && (
          <AddButton
            priority="link"
            aria-label={t('Add Equation')}
            onClick={() => {
              dispatch({
                type: updateAction,
                payload: [...(fields ?? []), {kind: FieldValueKind.EQUATION, field: ''}],
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
    </Fragment>
  );
}

export default Visualize;

function renderTag(kind: FieldValueKind, label: string) {
  let text, tagType;
  switch (kind) {
    case FieldValueKind.FUNCTION:
      text = 'f(x)';
      tagType = 'success' as keyof Theme['tag'];
      break;
    case FieldValueKind.CUSTOM_MEASUREMENT:
    case FieldValueKind.MEASUREMENT:
      text = 'field';
      tagType = 'highlight' as keyof Theme['tag'];
      break;
    case FieldValueKind.BREAKDOWN:
      text = 'field';
      tagType = 'highlight' as keyof Theme['tag'];
      break;
    case FieldValueKind.TAG:
      text = kind;
      tagType = 'warning' as keyof Theme['tag'];
      break;
    case FieldValueKind.NUMERIC_METRICS:
      text = 'f(x)';
      tagType = 'success' as keyof Theme['tag'];
      break;
    case FieldValueKind.FIELD:
      text = DEPRECATED_FIELDS.includes(label) ? 'deprecated' : 'field';
      tagType = 'highlight' as keyof Theme['tag'];
      break;
    default:
      text = kind;
  }

  return <BaseTag type={tagType}>{text}</BaseTag>;
}

export const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1 auto;
  min-width: 0;

  > button {
    width: 100%;
  }
`;

export const AggregateCompactSelect = styled(CompactSelect)<{
  hasColumnParameter: boolean;
}>`
  ${p =>
    p.hasColumnParameter
      ? `
    width: fit-content;
    left: 1px;

    ${TriggerLabel} {
      overflow: visible;
    }
  `
      : `
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
`;

export const PrimarySelectRow = styled('div')<{hasColumnParameter: boolean}>`
  display: flex;
  width: 100%;
  flex: 3;

  & > ${ColumnCompactSelect} > button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  & > ${AggregateCompactSelect} > button {
    ${p =>
      p.hasColumnParameter &&
      `
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    `}
  }
`;

export const FieldRow = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  width: 100%;
`;

export const StyledDeleteButton = styled(Button)``;

export const FieldExtras = styled('div')<{isChartWidget: boolean}>`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  flex: ${p => (p.isChartWidget ? '0' : '1')};
`;

const AddButton = styled(Button)`
  margin-top: ${space(1)};
`;

const AddButtons = styled('div')`
  display: inline-flex;
  gap: ${space(1.5)};
`;

const Fields = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

export const StyledArithmeticInput = styled(ArithmeticInput)`
  width: 100%;
`;

const StyledFieldGroup = styled(FieldGroup)`
  width: 100%;
  padding: 0px;
  border-bottom: none;
`;
