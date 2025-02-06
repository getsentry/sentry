import {Fragment, useMemo, useState} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import BaseTag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Input from 'sentry/components/input';
import Radio from 'sentry/components/radio';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
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
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import ArithmeticInput from 'sentry/views/discover/table/arithmeticInput';
import {
  BufferedInput,
  type ParameterDescription,
  validateColumnTypes,
} from 'sentry/views/discover/table/queryField';
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
  label: t('None'),
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
        fieldValues.filter(
          ({value}) =>
            (value.kind === FieldValueKind.FIELD ||
              value.kind === FieldValueKind.TAG ||
              value.kind === FieldValueKind.MEASUREMENT ||
              value.kind === FieldValueKind.CUSTOM_MEASUREMENT ||
              value.kind === FieldValueKind.METRICS ||
              value.kind === FieldValueKind.BREAKDOWN) &&
            validateColumnTypes(parameter.columnTypes as ValidateColumnTypes, value)
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
  let spanColumnOptions: any;
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
    // @ts-expect-error TS(7006): Parameter 'a' implicitly has an 'any' type.
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

            let aggregateOptions: Array<{
              label: string;
              trailingItems: React.ReactNode | null;
              value: string;
            }> = aggregates.map(option => ({
              value: option.value.meta.name,
              label: option.value.meta.name,
              trailingItems: renderTag(option.value.kind, option.value.meta.name) ?? null,
            }));
            aggregateOptions =
              isChartWidget ||
              isBigNumberWidget ||
              (state.dataset === WidgetType.RELEASE && !canDelete)
                ? aggregateOptions
                : [NONE_AGGREGATE, ...aggregateOptions];

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
              <FieldRow key={index}>
                {fields.length > 1 && state.displayType === DisplayType.BIG_NUMBER && (
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
                        trackAnalytics('dashboards_views.widget_builder.change', {
                          builder_version: WidgetBuilderVersion.SLIDEOUT,
                          field: 'visualize.selectAggregate',
                          from: source,
                          new_widget: !isEditing,
                          value: '',
                          widget_type: state.dataset ?? '',
                          organization,
                        });
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
                          value={parseFunction(stringFields?.[index] ?? '')?.name ?? ''}
                          position="bottom-start"
                          onChange={aggregateSelection => {
                            const isNone = aggregateSelection.value === NONE;
                            const newFields = cloneDeep(fields);
                            const currentField = newFields[index]!;
                            const newAggregate = aggregates.find(
                              option =>
                                option.value.meta.name === aggregateSelection.value
                            );
                            // Update the current field's aggregate with the new aggregate
                            if (!isNone) {
                              if (currentField.kind === FieldValueKind.FUNCTION) {
                                // Handle setting an aggregate from an aggregate
                                currentField.function[0] =
                                  aggregateSelection.value as AggregationKeyWithAlias;
                                if (
                                  newAggregate?.value.meta &&
                                  'parameters' in newAggregate.value.meta
                                ) {
                                  // There are aggregates that have no parameters, so wipe out the argument
                                  // if it's supposed to be empty
                                  if (newAggregate.value.meta.parameters.length === 0) {
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
                                    const newAggregateIsApdexOrUserMisery =
                                      newAggregate?.value.meta.name === 'apdex' ||
                                      newAggregate?.value.meta.name === 'user_misery';
                                    const isValidColumn =
                                      !newAggregateIsApdexOrUserMisery &&
                                      Boolean(
                                        newColumnOptions.find(
                                          option =>
                                            option.value === currentField.function[1]
                                        )?.value
                                      );
                                    currentField.function[1] =
                                      (isValidColumn
                                        ? currentField.function[1]
                                        : newAggregate.value.meta.parameters[0]!
                                            .defaultValue) ?? '';

                                    // Set the remaining parameters for the new aggregate
                                    for (
                                      let i = 1; // The first parameter is the column selection
                                      i < newAggregate.value.meta.parameters.length;
                                      i++
                                    ) {
                                      // Increment by 1 to skip past the aggregate name
                                      currentField.function[i + 1] =
                                        newAggregate.value.meta.parameters[
                                          i
                                        ]!.defaultValue;
                                    }
                                  }

                                  // Wipe out the remaining parameters that are unnecessary
                                  // This is necessary for transitioning between aggregates that have
                                  // more parameters to ones of fewer parameters
                                  for (
                                    let i = newAggregate.value.meta.parameters.length;
                                    i < MAX_FUNCTION_PARAMETERS;
                                    i++
                                  ) {
                                    currentField.function[i + 1] = undefined;
                                  }
                                }
                              } else {
                                if (
                                  !newAggregate ||
                                  !('parameters' in newAggregate.value.meta)
                                ) {
                                  return;
                                }

                                // Handle setting an aggregate from a field
                                const newFunction: AggregateFunction = [
                                  aggregateSelection.value as AggregationKeyWithAlias,
                                  ((newAggregate?.value.meta?.parameters.length > 0 &&
                                    currentField.field) ||
                                    newAggregate?.value.meta?.parameters?.[0]
                                      ?.defaultValue) ??
                                    '',
                                  newAggregate?.value.meta?.parameters?.[1]
                                    ?.defaultValue ?? undefined,
                                  newAggregate?.value.meta?.parameters?.[2]
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
                                  newAggregate?.value.meta &&
                                  'parameters' in newAggregate.value.meta
                                ) {
                                  newAggregate?.value.meta.parameters.forEach(
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
                              trackAnalytics('dashboards_views.widget_builder.change', {
                                builder_version: WidgetBuilderVersion.SLIDEOUT,
                                field: 'visualize.updateAggregate',
                                from: source,
                                new_widget: !isEditing,
                                value: 'aggregate',
                                widget_type: state.dataset ?? '',
                                organization,
                              });
                            } else {
                              // Handle selecting None so we can select just a field, e.g. for samples
                              // If none is selected, set the field to a field value

                              // When selecting None, the next possible columns may be different from the
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
                                  (datasetConfig.filterTableOptions?.(option) ?? true)
                              );
                              const functionArgInValidColumnFields =
                                ('function' in currentField &&
                                  validColumnFields.find(
                                    option =>
                                      option.value.meta.name === currentField.function[1]
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

                              trackAnalytics('dashboards_views.widget_builder.change', {
                                builder_version: WidgetBuilderVersion.SLIDEOUT,
                                field: 'visualize.updateAggregate',
                                from: source,
                                new_widget: !isEditing,
                                value: 'column',
                                widget_type: state.dataset ?? '',
                                organization,
                              });
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
                                currentField.function[1] = newField.value as string;
                              }
                              if (currentField.kind === FieldValueKind.FIELD) {
                                currentField.field = newField.value as string;
                              }
                              dispatch({
                                type: updateAction,
                                payload: newFields,
                              });
                              setError?.({...error, queries: []});
                              trackAnalytics('dashboards_views.widget_builder.change', {
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
                              });
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
                                        newFields[index]!.kind !== FieldValueKind.FUNCTION
                                      ) {
                                        return;
                                      }
                                      newFields[index]!.function[parameterIndex + 2] =
                                        value;
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
                      {isApdexOrUserMisery && field.kind === FieldValueKind.FUNCTION && (
                        <AggregateParameterField
                          parameter={matchingAggregate?.value.meta.parameters[0]}
                          fieldValue={field}
                          currentValue={field.function[1]}
                          onChange={value => {
                            const newFields = cloneDeep(fields);
                            if (newFields[index]!.kind !== FieldValueKind.FUNCTION) {
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
                    disabled={fields.length <= 1 || !canDelete || isOnlyFieldOrAggregate}
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
            );
          })}
        </Fields>
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

function AggregateParameterField({
  parameter,
  fieldValue,
  onChange,
  currentValue,
}: {
  currentValue: string;
  fieldValue: QueryFieldValue;
  onChange: (value: string) => void;
  parameter: ParameterDescription;
}) {
  if (parameter.kind === 'value') {
    const inputProps = {
      required: parameter.required,
      value:
        currentValue ?? ('defaultValue' in parameter && parameter?.defaultValue) ?? '',
      onUpdate: (value: any) => {
        onChange(value);
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          onChange(e.currentTarget.value);
        }
      },
      placeholder: parameter.placeholder,
    };
    switch (parameter.dataType) {
      case 'number':
        return (
          <BufferedInput
            name="refinement"
            key={`parameter:number-${currentValue}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*(\.[0-9]*)?"
            aria-label={t('Numeric Input')}
            {...inputProps}
          />
        );
      case 'integer':
        return (
          <BufferedInput
            name="refinement"
            key="parameter:integer"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={t('Integer Input')}
            {...inputProps}
          />
        );
      default:
        return (
          <BufferedInput
            name="refinement"
            key="parameter:text"
            type="text"
            aria-label={t('Text Input')}
            {...inputProps}
          />
        );
    }
  }
  if (parameter.kind === 'dropdown') {
    return (
      <SelectControl
        key="dropdown"
        name="dropdown"
        menuPlacement="auto"
        placeholder={t('Select value')}
        options={parameter.options}
        value={currentValue}
        required={parameter.required}
        onChange={({value}: any) => {
          onChange(value);
        }}
        searchable
      />
    );
  }
  throw new Error(`Unknown parameter type encountered for ${fieldValue}`);
}

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

const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1 auto;
  min-width: 0;

  > button {
    width: 100%;
  }
`;

const AggregateCompactSelect = styled(CompactSelect)<{hasColumnParameter: boolean}>`
  ${p =>
    p.hasColumnParameter
      ? `
    width: fit-content;
    max-width: 150px;
    left: 1px;
  `
      : `
    width: 100%;
  `}

  > button {
    width: 100%;
  }
`;

const LegendAliasInput = styled(Input)``;

const ParameterRefinements = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};

  > * {
    flex: 1;
  }
`;

const FieldBar = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(1)};
  flex: 3;
`;

const PrimarySelectRow = styled('div')<{hasColumnParameter: boolean}>`
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

const FieldRow = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const StyledDeleteButton = styled(Button)``;

const FieldExtras = styled('div')<{isChartWidget: boolean}>`
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

const StyledArithmeticInput = styled(ArithmeticInput)`
  width: 100%;
`;

const StyledFieldGroup = styled(FieldGroup)`
  width: 100%;
  padding: 0px;
  border-bottom: none;
`;
