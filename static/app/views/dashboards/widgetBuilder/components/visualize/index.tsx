import {Fragment, type ReactNode, useMemo, useState} from 'react';
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
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import SortableVisualizeFieldWrapper from 'sentry/views/dashboards/widgetBuilder/components/common/sortableFieldWrapper';
import {AggregateParameterField} from 'sentry/views/dashboards/widgetBuilder/components/visualize/aggregateParameterField';
import {
  ColumnCompactSelect,
  SelectRow,
} from 'sentry/views/dashboards/widgetBuilder/components/visualize/selectRow';
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

export const NONE = 'none';

export const NONE_AGGREGATE = {
  textValue: t('field'),
  label: tct('[emphasis:field]', {
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
          dataset === WidgetType.SPANS
            ? prettifyTagKey(option.value.meta.name)
            : option.value.meta.name,

        trailingItems: renderTag(
          option.value.kind,
          option.value.meta.name,
          option.value.kind !== FieldValueKind.FUNCTION &&
            option.value.kind !== FieldValueKind.EQUATION
            ? option.value.meta.dataType!
            : undefined
        ),
        disabled: !supported,
        tooltip:
          !supported && field.kind === FieldValueKind.FUNCTION
            ? tct('This field is not available for the [aggregate] function', {
                aggregate: <strong>{field.function[0]}</strong>,
              })
            : undefined,
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

  return a.label.localeCompare(b.label);
}

export function getColumnOptions(
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
    return formatColumnOptions(
      dataset,
      fieldValues,
      columnFilterMethod,
      selectedField
    ).sort(_sortFn);
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
    spanColumnOptions.sort(_sortFn);
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
        title={isChartWidget ? t('Visualize') : t('Columns')}
        tooltipText={
          isChartWidget
            ? t(
                'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
              )
            : t('Columns to display in your table. You can also add equations.')
        }
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
                const columnOptions =
                  state.dataset === WidgetType.SPANS &&
                  field.kind !== FieldValueKind.FUNCTION
                    ? spanColumnOptions
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
                > = aggregates.map(option => ({
                  value:
                    option.value.kind === FieldValueKind.FUNCTION
                      ? getAggregateValueKey(option.value.meta.name)
                      : option.value.meta.name,
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
                        }))
                        .sort(_sortFn),
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
                            option.value.meta.name,
                            option.value.kind !== FieldValueKind.FUNCTION &&
                              option.value.kind !== FieldValueKind.EQUATION
                              ? option.value.meta.dataType!
                              : undefined
                          ),
                        }))
                        .sort(_sortFn),
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
                              />
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
          aria-label={
            isChartWidget
              ? t('Add Series')
              : isBigNumberWidget
                ? t('Add Field')
                : t('Add Column')
          }
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
          {isChartWidget
            ? t('+ Add Series')
            : isBigNumberWidget
              ? t('+ Add Field')
              : t('+ Add Column')}
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

export function renderTag(kind: FieldValueKind, label: string, dataType?: string) {
  if (dataType) {
    switch (dataType) {
      case 'boolean':
      case 'date':
      case 'string':
        return <BaseTag type="highlight">{t('string')}</BaseTag>;
      case 'duration':
      case 'integer':
      case 'percentage':
      case 'number':
        return <BaseTag type="success">{t('number')}</BaseTag>;
      default:
        return <BaseTag>{dataType}</BaseTag>;
    }
  }
  let text, tagType;
  switch (kind) {
    case FieldValueKind.FUNCTION:
      text = 'f(x)';
      tagType = 'warning' as keyof Theme['tag'];
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
      tagType = 'warning' as keyof Theme['tag'];
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
  min-width: 0;
`;

export const PrimarySelectRow = styled('div')<{hasColumnParameter: boolean}>`
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
  min-width: 0;
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
