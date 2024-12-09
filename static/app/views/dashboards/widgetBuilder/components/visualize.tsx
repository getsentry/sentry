import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import Input from 'sentry/components/input';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type AggregationKeyWithAlias,
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
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

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

  // TODO: no parameters should show up as primary options?
  // let aggregateOptions = Object.values(fieldOptions).filter(
  //   option => option.value.kind === 'function' && option.value.meta.parameters.length > 0
  // );
  const aggregateOptions = useMemo(
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
                // TODO: This should allow for aggregates without parameters
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

          return (
            <FieldRow key={index}>
              <FieldBar data-testid={'field-bar'}>
                <ColumnCompactSelect
                  searchable
                  options={columnOptions}
                  value={parseFunction(stringFields?.[index] ?? '')?.arguments[0] ?? ''}
                  onChange={newField => {
                    // TODO: Handle scalars (i.e. no aggregate, for tables)
                    // Update the current field's aggregate with the new aggregate
                    if (field.kind === 'function') {
                      field.function[1] = newField.value as string;
                    }
                    dispatch({
                      type: updateAction,
                      payload: fields,
                    });
                  }}
                  triggerProps={{
                    'aria-label': t('Column Selection'),
                  }}
                />
                {/* TODO: Add equation options */}
                {/* TODO: Handle aggregates with no parameters */}
                {/* TODO: Handle aggregates with multiple parameters */}
                <AggregateCompactSelect
                  options={aggregateOptions.map(option => ({
                    value: option.value.meta.name,
                    label: option.value.meta.name,
                  }))}
                  value={parseFunction(stringFields?.[index] ?? '')?.name ?? ''}
                  onChange={newAggregate => {
                    // TODO: Handle scalars (i.e. no aggregate, for tables)
                    // Update the current field's aggregate with the new aggregate
                    const currentField = fields?.[index];
                    if (currentField.kind === 'function') {
                      currentField.function[0] =
                        newAggregate.value as AggregationKeyWithAlias;
                    }
                    dispatch({
                      type: updateAction,
                      payload: fields,
                    });
                  }}
                  triggerProps={{
                    'aria-label': t('Aggregate Selection'),
                  }}
                />
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
                  kind: 'function',
                },
              ],
            })
          }
        >
          {t('+ Add Series')}
        </AddButton>
        <AddButton priority="link" aria-label={t('Add Equation')} onClick={() => {}}>
          {t('+ Add Equation')}
        </AddButton>
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
