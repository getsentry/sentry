import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {CompactSelect} from 'sentry/components/compactSelect';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {
  type AggregateParameter,
  type AggregationKeyWithAlias,
  type AggregationRefinement,
  parseFunction,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  AggregateCompactSelect,
  getAggregateValueKey,
  getColumnOptions,
  NONE,
  parseAggregateFromValueKey,
  PrimarySelectRow,
} from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';

type AggregateFunction = [
  AggregationKeyWithAlias,
  string,
  AggregationRefinement,
  AggregationRefinement,
];

const MAX_FUNCTION_PARAMETERS = 4;

interface SelectRowProps {
  aggregateOptions: Array<SelectValue<string>>;
  aggregates: Array<SelectValue<FieldValue>>;
  columnOptions: Array<SelectValue<string>>;
  field: QueryFieldValue;
  fieldOptions: Record<string, SelectValue<FieldValue>>;
  fields: QueryFieldValue[];
  hasColumnParameter: boolean;
  index: number;
  isEditing: boolean;
  source: string;
  columnFilterMethod?: (
    option: FieldValueOption,
    fieldValue?: QueryFieldValue | undefined
  ) => boolean;
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
  stringFields?: string[];
}

function renderDropdownMenuFooter() {
  return (
    <FooterWrapper>
      <IconInfo size="xs" />
      {t('Select relevant fields or tags to use as groups within the table')}
    </FooterWrapper>
  );
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

export function SelectRow({
  field,
  index,
  hasColumnParameter,
  columnOptions,
  aggregateOptions,
  stringFields,
  error,
  setError,
  fields,
  source,
  isEditing,
  fieldOptions,
  columnFilterMethod,
  aggregates,
}: SelectRowProps) {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();
  const datasetConfig = getDatasetConfig(state.dataset);
  const columnSelectRef = useRef<HTMLDivElement>(null);

  const isChartWidget =
    state.displayType !== DisplayType.TABLE &&
    state.displayType !== DisplayType.BIG_NUMBER;

  const updateAction = isChartWidget
    ? BuilderStateAction.SET_Y_AXIS
    : BuilderStateAction.SET_FIELDS;

  const openColumnSelect = useCallback(() => {
    requestAnimationFrame(() => {
      columnSelectRef.current?.querySelector('button')?.click();
    });
  }, []);

  return (
    <PrimarySelectRow hasColumnParameter={hasColumnParameter}>
      <AggregateCompactSelect
        searchable
        hasColumnParameter={hasColumnParameter}
        disabled={aggregateOptions.length <= 1}
        options={aggregateOptions}
        value={
          parseFunction(stringFields?.[index] ?? '')?.name
            ? getAggregateValueKey(parseFunction(stringFields?.[index] ?? '')?.name)
            : NONE
        }
        position="bottom-start"
        menuFooter={
          state.displayType === DisplayType.TABLE ? renderDropdownMenuFooter : undefined
        }
        onChange={dropdownSelection => {
          const isNone = dropdownSelection.value === NONE;
          let newFields = cloneDeep(fields);
          const currentField = newFields[index]!;
          const selectedAggregate = aggregates.find(
            option =>
              // Convert the aggregate key to the same format as the dropdown value
              // when checking for a match
              getAggregateValueKey(option.value.meta.name) === dropdownSelection.value
          );
          // Update the current field's aggregate with the new aggregate
          if (!selectedAggregate && !isNone) {
            const functionFields = newFields.filter(
              newField => newField.kind === FieldValueKind.FUNCTION
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
                newField => newField.kind === FieldValueKind.FUNCTION
              );

              // add a function in the off chance the user gets into a state where
              // they don't already have a function there
              if (!atLeastOneFunction) {
                newFields = [...newFields, datasetConfig.defaultField];
              }
            } else {
              // Handles new selection of a field from the aggregate dropdown
              newFields[index] = {
                kind: FieldValueKind.FIELD,
                field: dropdownSelection.value as string,
              };
            }
            trackAnalytics('dashboards_views.widget_builder.change', {
              builder_version: WidgetBuilderVersion.SLIDEOUT,
              field: 'visualize.updateAggregate',
              from: source,
              new_widget: !isEditing,
              value: 'direct_column',
              widget_type: state.dataset ?? '',
              organization,
            });
          } else if (!isNone) {
            if (currentField.kind === FieldValueKind.FUNCTION) {
              // Handle setting an aggregate from an aggregate
              currentField.function[0] = parseAggregateFromValueKey(
                dropdownSelection.value as string
              ) as AggregationKeyWithAlias;
              if (
                selectedAggregate?.value.meta &&
                'parameters' in selectedAggregate.value.meta
              ) {
                // There are aggregates that have no parameters, so wipe out the argument
                // if it's supposed to be empty
                if (selectedAggregate.value.meta.parameters.length === 0) {
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
                    selectedAggregate?.value.meta.name === 'apdex' ||
                    selectedAggregate?.value.meta.name === 'user_misery';
                  const isValidColumn =
                    !selectedAggregateIsApdexOrUserMisery &&
                    Boolean(
                      newColumnOptions.find(
                        option =>
                          option.value === currentField.function[1] && !option.disabled
                      )?.value
                    );
                  currentField.function[1] =
                    (isValidColumn
                      ? currentField.function[1]
                      : selectedAggregate.value.meta.parameters[0]!.defaultValue) ?? '';

                  // Set the remaining parameters for the new aggregate
                  for (
                    let i = 1; // The first parameter is the column selection
                    i < selectedAggregate.value.meta.parameters.length;
                    i++
                  ) {
                    // Increment by 1 to skip past the aggregate name
                    currentField.function[i + 1] =
                      selectedAggregate.value.meta.parameters[i]!.defaultValue;
                  }
                }

                // Wipe out the remaining parameters that are unnecessary
                // This is necessary for transitioning between aggregates that have
                // more parameters to ones of fewer parameters
                for (
                  let i = selectedAggregate.value.meta.parameters.length;
                  i < MAX_FUNCTION_PARAMETERS;
                  i++
                ) {
                  currentField.function[i + 1] = undefined;
                }
              }

              openColumnSelect();
            } else {
              if (!selectedAggregate || !('parameters' in selectedAggregate.value.meta)) {
                return;
              }

              // Handle setting an aggregate from a field
              const newFunction: AggregateFunction = [
                parseAggregateFromValueKey(
                  dropdownSelection.value as string
                ) as AggregationKeyWithAlias,
                ((selectedAggregate?.value.meta?.parameters.length > 0 &&
                  currentField.field) ||
                  selectedAggregate?.value.meta?.parameters?.[0]?.defaultValue) ??
                  '',
                selectedAggregate?.value.meta?.parameters?.[1]?.defaultValue ?? undefined,
                selectedAggregate?.value.meta?.parameters?.[2]?.defaultValue ?? undefined,
              ];
              const newColumnOptions = getColumnOptions(
                state.dataset ?? WidgetType.ERRORS,
                {
                  kind: FieldValueKind.FUNCTION,
                  function: newFunction,
                },
                fieldOptions,
                // If no aggregate filter method is provided, show all options
                datasetConfig.filterAggregateParams ?? (() => true)
              );
              if (
                selectedAggregate?.value.meta &&
                'parameters' in selectedAggregate.value.meta
              ) {
                selectedAggregate?.value.meta.parameters.forEach(
                  (parameter, parameterIndex) => {
                    const isValidParameter =
                      validateParameter(
                        newColumnOptions,
                        parameter,
                        newFunction[parameterIndex + 1]
                      ) &&
                      !newColumnOptions.find(
                        option =>
                          option.value === newFunction[parameterIndex + 1] &&
                          option.disabled
                      )?.disabled;
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

              // Only open the column select if there are multiple valid columns
              if (newColumnOptions.filter(option => !option.disabled).length > 1) {
                openColumnSelect();
              }
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
            // Handle selecting NONE so we can select just a field, e.g. for samples
            // If NONE is selected, set the field to a field value

            // When selecting NONE, the next possible columns may be different from the
            // possible columns for the previous aggregate. Calculate the valid columns,
            // see if the current field's function argument is in the valid columns, and if so,
            // set the field to a field value. Otherwise, set the field to the first valid column.
            const validColumnFields = getColumnOptions(
              state.dataset ?? WidgetType.ERRORS,
              {
                kind: FieldValueKind.FIELD,
                field: '',
              },
              fieldOptions,
              // If no column filter method is provided, show all options
              columnFilterMethod ?? (() => true)
            );
            const functionArgInValidColumnFields =
              (currentField.kind === FieldValueKind.FUNCTION &&
                validColumnFields.find(
                  option => option.value === currentField.function[1]
                )) ||
              undefined;
            const validColumn =
              functionArgInValidColumnFields?.value ??
              validColumnFields?.[0]?.value ??
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
            openColumnSelect();
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
        <SelectWrapper ref={columnSelectRef}>
          <ColumnCompactSelect
            searchable
            options={columnOptions}
            value={
              field.kind === FieldValueKind.FUNCTION
                ? parseFunction(stringFields?.[index] ?? '')?.arguments[0] ?? ''
                : field.field
            }
            onChange={newField => {
              const newFields = cloneDeep(fields);
              const currentField = newFields[index]!;
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
                  currentField.kind === FieldValueKind.FIELD ? 'column' : 'aggregate',
                widget_type: state.dataset ?? '',
                organization,
              });
            }}
            triggerProps={{
              'aria-label': t('Column Selection'),
            }}
          />
        </SelectWrapper>
      )}
    </PrimarySelectRow>
  );
}

export const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1 auto;
  min-width: 0;

  > button {
    width: 100%;
  }
`;

const FooterWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const SelectWrapper = styled('div')`
  display: contents;
`;
