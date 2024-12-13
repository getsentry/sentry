import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import Input from 'sentry/components/input';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type AggregationKeyWithAlias,
  type AggregationRefinement,
  generateFieldAsString,
  parseFunction,
  prettifyTagKey,
} from 'sentry/utils/discover/fields';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import ArithmeticInput from 'sentry/views/discover/table/arithmeticInput';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

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
  if (state.dataset === WidgetType.SPANS && isChartWidget) {
    tags = numericSpanTags;
  } else if (state.dataset === WidgetType.SPANS && !isChartWidget) {
    tags = stringSpanTags;
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
          const columnOptions = Object.values(fieldOptions)
            .filter(option => {
              return (
                option.value.kind !== FieldValueKind.FUNCTION &&
                (datasetConfig.filterYAxisAggregateParams?.(
                  field,
                  state.displayType ?? DisplayType.TABLE
                )?.(option) ??
                  true)
              );
            })
            .map(option => ({
              value: option.value.meta.name,
              label:
                state.dataset === WidgetType.SPANS
                  ? prettifyTagKey(option.value.meta.name)
                  : option.value.meta.name,
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
                    <ColumnCompactSelect
                      searchable
                      options={columnOptions}
                      value={
                        field.kind === FieldValueKind.FUNCTION
                          ? parseFunction(stringFields?.[index] ?? '')?.arguments[0] ?? ''
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
                    {/* TODO: Handle aggregates with multiple parameters */}
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
                        // Update the current field's aggregate with the new aggregate
                        if (!isNone) {
                          const newAggregate = aggregates.find(
                            option => option.value.meta.name === aggregateSelection.value
                          );
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
                                    newAggregate.value.meta.parameters[0].defaultValue) ??
                                  '';
                              }
                            }
                          } else {
                            // Handle setting a field from an aggregate
                            const newFunction: [
                              AggregationKeyWithAlias,
                              string,
                              AggregationRefinement,
                              AggregationRefinement,
                            ] = ['', '', undefined, undefined];
                            newFunction[0] =
                              aggregateSelection.value as AggregationKeyWithAlias;
                            if (
                              newAggregate?.value.meta &&
                              'parameters' in newAggregate.value.meta
                            ) {
                              newAggregate?.value.meta.parameters.forEach(
                                (parameter, parameterIndex) => {
                                  // Increment by 1 to skip past the aggregate name
                                  newFunction[parameterIndex + 1] =
                                    parameter.defaultValue;
                                }
                              );
                            }
                            newFields[index] = {
                              kind: FieldValueKind.FUNCTION,
                              function: newFunction,
                            };
                          }
                        }
                        if (isNone) {
                          // Handle selecting None so we can select just a field, e.g. for samples
                          // If none is selected, set the field to a field value
                          newFields[index] = {
                            kind: FieldValueKind.FIELD,
                            field:
                              'function' in currentField
                                ? currentField?.function[1] ?? columnOptions[0].value
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

const FieldBar = styled('div')`
  display: flex;
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
