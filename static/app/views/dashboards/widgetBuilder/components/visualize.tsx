import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Input from 'sentry/components/input';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type AggregationKeyWithAlias,
  type AggregationRefinement,
  classifyTagKey,
  generateFieldAsString,
  parseFunction,
  prettifyTagKey,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import ArithmeticInput from 'sentry/views/discover/table/arithmeticInput';
import {
  BufferedInput,
  type ParameterDescription,
} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
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
};

function Visualize() {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();
  let tags = useTags();
  const {customMeasurements} = useCustomMeasurements();

  const isChartWidget =
    state.displayType !== DisplayType.TABLE &&
    state.displayType !== DisplayType.BIG_NUMBER;
  const numericSpanTags = useSpanTags('number');
  const stringSpanTags = useSpanTags('string');

  // Span column options are explicitly defined and bypass all of the
  // fieldOptions filtering and logic used for showing options for
  // chart types.
  let spanColumnOptions;
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

  return (
    <Fragment>
      <SectionHeader
        title={t('Visualize')}
        tooltipText={t(
          'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
        )}
      />
      <Fields>
        {fields?.map((field, index) => {
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
          const columnOptions = Object.values(fieldOptions)
            .filter(option => {
              // Don't show any aggregates under the columns, and if
              // there isn't a filter method, just show the option
              return (
                option.value.kind !== FieldValueKind.FUNCTION &&
                (columnFilterMethod?.(option, field) ?? true)
              );
            })
            .map(option => ({
              value: option.value.meta.name,
              label:
                state.dataset === WidgetType.SPANS
                  ? prettifyTagKey(option.value.meta.name)
                  : option.value.meta.name,

              // For the spans dataset, all of the options are measurements,
              // so we force the number badge to show
              trailingItems:
                state.dataset === WidgetType.SPANS ? (
                  <TypeBadge kind={FieldKind.MEASUREMENT} />
                ) : null,
            }));

          const aggregateOptions = aggregates.map(option => ({
            value: option.value.meta.name,
            label: option.value.meta.name,
          }));

          let matchingAggregate;
          if (
            fields[index].kind === FieldValueKind.FUNCTION &&
            FieldValueKind.FUNCTION in fields[index]
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

          return (
            <FieldRow key={index}>
              <FieldBar data-testid={'field-bar'}>
                {field.kind === FieldValueKind.EQUATION ? (
                  <StyledArithmeticInput
                    name="arithmetic"
                    key="parameter:text"
                    type="text"
                    required
                    value={field.field}
                    onUpdate={value =>
                      dispatch({
                        type: updateAction,
                        payload: fields.map((_field, i) =>
                          i === index ? {..._field, field: value} : _field
                        ),
                      })
                    }
                    options={fields}
                    placeholder={t('Equation')}
                    aria-label={t('Equation')}
                  />
                ) : (
                  <Fragment>
                    <PrimarySelectRow>
                      <ColumnCompactSelect
                        searchable
                        options={
                          state.dataset === WidgetType.SPANS &&
                          field.kind !== FieldValueKind.FUNCTION
                            ? spanColumnOptions
                            : columnOptions
                        }
                        value={
                          field.kind === FieldValueKind.FUNCTION
                            ? parseFunction(stringFields?.[index] ?? '')?.arguments[0] ??
                              ''
                            : field.field
                        }
                        onChange={newField => {
                          // Update the current field's aggregate with the new aggregate
                          if (field.kind === FieldValueKind.FUNCTION) {
                            field.function[1] = newField.value as string;
                          }
                          if (field.kind === FieldValueKind.FIELD) {
                            field.field = newField.value as string;
                          }
                          dispatch({
                            type: updateAction,
                            payload: fields,
                          });
                        }}
                        triggerProps={{
                          'aria-label': t('Column Selection'),
                        }}
                        disabled={
                          fields[index].kind === FieldValueKind.FUNCTION &&
                          matchingAggregate?.value.meta.parameters.length === 0
                        }
                      />
                      <AggregateCompactSelect
                        options={
                          isChartWidget
                            ? aggregateOptions
                            : [NONE_AGGREGATE, ...aggregateOptions]
                        }
                        value={parseFunction(stringFields?.[index] ?? '')?.name ?? ''}
                        onChange={aggregateSelection => {
                          const isNone = aggregateSelection.value === NONE;
                          const newFields = cloneDeep(fields);
                          const currentField = newFields[index];
                          const newAggregate = aggregates.find(
                            option => option.value.meta.name === aggregateSelection.value
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
                                  currentField.function[1] =
                                    (currentField.function[1] ||
                                      newAggregate.value.meta.parameters[0]
                                        .defaultValue) ??
                                    '';
                                  // Set the remaining parameters for the new aggregate
                                  for (
                                    let i = 1; // The first parameter is the column selection
                                    i < newAggregate.value.meta.parameters.length;
                                    i++
                                  ) {
                                    // Increment by 1 to skip past the aggregate name
                                    currentField.function[i + 1] =
                                      newAggregate.value.meta.parameters[i].defaultValue;
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
                                (currentField.field ||
                                  newAggregate?.value.meta?.parameters?.[0]
                                    ?.defaultValue) ??
                                  '',
                                newAggregate?.value.meta?.parameters?.[1]?.defaultValue ??
                                  undefined,
                                newAggregate?.value.meta?.parameters?.[2]?.defaultValue ??
                                  undefined,
                              ];
                              if (
                                newAggregate?.value.meta &&
                                'parameters' in newAggregate.value.meta
                              ) {
                                newAggregate?.value.meta.parameters.forEach(
                                  (parameter, parameterIndex) => {
                                    // Increment by 1 to skip past the aggregate name
                                    newFunction[parameterIndex + 1] =
                                      newFunction[parameterIndex + 1] ??
                                      parameter.defaultValue;
                                  }
                                );
                              }
                              newFields[index] = {
                                kind: FieldValueKind.FUNCTION,
                                function: newFunction,
                              };
                            }
                          } else {
                            // Handle selecting None so we can select just a field, e.g. for samples
                            // If none is selected, set the field to a field value
                            newFields[index] = {
                              kind: FieldValueKind.FIELD,
                              field:
                                'function' in currentField
                                  ? (currentField.function[1] as string) ??
                                    columnOptions[0].value
                                  : '',
                            };
                          }
                          dispatch({
                            type: updateAction,
                            payload: newFields,
                          });
                        }}
                        triggerProps={{
                          'aria-label': t('Aggregate Selection'),
                        }}
                      />
                    </PrimarySelectRow>
                    {field.kind === FieldValueKind.FUNCTION &&
                      parameterRefinements.length > 0 && (
                        <ParameterRefinements>
                          {parameterRefinements.map((parameter, parameterIndex) => {
                            // The current value is displaced by 2 because the first two parameters
                            // are the aggregate name and the column selection
                            const currentValue = field.function[parameterIndex + 2] || '';
                            const key = `${field.function.join('_')}-${parameterIndex}`;
                            return (
                              <AggregateParameter
                                key={key}
                                parameter={parameter}
                                fieldValue={field}
                                currentValue={currentValue}
                                onChange={value => {
                                  const newFields = cloneDeep(fields);
                                  if (newFields[index].kind !== FieldValueKind.FUNCTION) {
                                    return;
                                  }
                                  newFields[index].function[parameterIndex + 2] = value;
                                  dispatch({
                                    type: updateAction,
                                    payload: newFields,
                                  });
                                }}
                              />
                            );
                          })}
                        </ParameterRefinements>
                      )}
                  </Fragment>
                )}
              </FieldBar>
              <FieldExtras>
                <LegendAliasInput
                  type="text"
                  name="name"
                  placeholder={t('Add Alias')}
                  onChange={() => {}}
                />
                <StyledDeleteButton
                  borderless
                  icon={<IconDelete />}
                  size="zero"
                  disabled={fields.length <= 1}
                  onClick={() =>
                    dispatch({
                      type: updateAction,
                      payload: fields?.filter((_field, i) => i !== index) ?? [],
                    })
                  }
                  aria-label={t('Remove field')}
                />
              </FieldExtras>
            </FieldRow>
          );
        })}
      </Fields>

      <AddButtons>
        <AddButton
          priority="link"
          aria-label={isChartWidget ? t('Add Series') : t('Add Field')}
          onClick={() =>
            dispatch({
              type: updateAction,
              payload: [
                ...(fields ?? []),
                // TODO: Define a default aggregate/field for the datasets?
                {
                  function: ['count', '', undefined, undefined],
                  kind: FieldValueKind.FUNCTION,
                },
              ],
            })
          }
        >
          {t('+ Add Series')}
        </AddButton>
        {datasetConfig.enableEquations && (
          <AddButton
            priority="link"
            aria-label={t('Add Equation')}
            onClick={() =>
              dispatch({
                type: updateAction,
                payload: [...(fields ?? []), {kind: FieldValueKind.EQUATION, field: ''}],
              })
            }
          >
            {t('+ Add Equation')}
          </AddButton>
        )}
      </AddButtons>
    </Fragment>
  );
}

export default Visualize;

function AggregateParameter({
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
        parameter.value ?? ('defaultValue' in parameter && parameter?.defaultValue) ?? '',
      onUpdate: value => {
        onChange(value);
      },
      placeholder: parameter.placeholder,
    };
    switch (parameter.dataType) {
      case 'number':
        return (
          <BufferedInput
            name="refinement"
            key="parameter:number"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*(\.[0-9]*)?"
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
            {...inputProps}
          />
        );
      default:
        return (
          <BufferedInput
            name="refinement"
            key="parameter:text"
            type="text"
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
        onChange={({value}) => {
          onChange(value);
        }}
      />
    );
  }
  throw new Error(`Unknown parameter type encountered for ${fieldValue}`);
}

const ColumnCompactSelect = styled(CompactSelect)`
  flex: 1 1 auto;
  min-width: 0;

  > button {
    width: 100%;
  }
`;

const AggregateCompactSelect = styled(CompactSelect)`
  width: fit-content;
  max-width: 150px;
  left: -1px;

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

const PrimarySelectRow = styled('div')`
  display: flex;
  width: 100%;
  flex: 3;

  & > ${ColumnCompactSelect} > button {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  & > ${AggregateCompactSelect} > button {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

const FieldRow = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const StyledDeleteButton = styled(Button)``;

const FieldExtras = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  flex: 1;
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
