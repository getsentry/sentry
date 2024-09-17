import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Radio from 'sentry/components/radio';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {addIncompatibleFunctions} from 'sentry/views/dashboards/widgetBuilder/utils';
import {QueryField} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import {AddButton} from './addButton';
import {DeleteButton} from './deleteButton';

interface Props {
  aggregates: QueryFieldValue[];
  displayType: DisplayType;
  /**
   * Fired when aggregates are added/removed/modified/reordered.
   */
  onChange: (aggregates: QueryFieldValue[], selectedAggregate?: number) => void;
  tags: TagCollection;
  widgetType: Widget['widgetType'];
  errors?: Record<string, any>;
  noFieldsMessage?: string;
  selectedAggregate?: number;
}

export function YAxisSelector({
  displayType,
  widgetType,
  aggregates,
  tags,
  onChange,
  errors,
  noFieldsMessage,
  selectedAggregate,
}: Props) {
  const organization = useOrganization();
  const datasetConfig = getDatasetConfig(widgetType);

  const {customMeasurements} = useCustomMeasurements();

  function handleAddFields(event: React.MouseEvent) {
    event.preventDefault();

    const newAggregates = [
      ...aggregates,
      {kind: FieldValueKind.FIELD, field: ''} as QueryFieldValue,
    ];
    const newSelectedAggregate = newAggregates.length - 1;
    onChange(newAggregates, newSelectedAggregate);
  }

  function handleAddEquation(event: React.MouseEvent) {
    event.preventDefault();

    const newAggregates = [
      ...aggregates,
      {kind: FieldValueKind.EQUATION, field: '', selected: false} as QueryFieldValue,
    ];
    const newSelectedAggregate = newAggregates.length - 1;
    onChange(newAggregates, newSelectedAggregate);
  }

  function handleRemoveQueryField(event: React.MouseEvent, fieldIndex: number) {
    event.preventDefault();

    const newAggregates = [...aggregates];
    newAggregates.splice(fieldIndex, 1);
    let newSelectedAggregate = selectedAggregate;
    if (selectedAggregate === fieldIndex) {
      newSelectedAggregate = newAggregates.length - 1;
    }
    onChange(newAggregates, newSelectedAggregate);
  }

  function handleChangeQueryField(value: QueryFieldValue, fieldIndex: number) {
    const newAggregates = [...aggregates];
    newAggregates[fieldIndex] = value;
    onChange(newAggregates);
  }

  const fieldError = errors?.find(error => error?.aggregates)?.aggregates;
  const canDelete = aggregates.length > 1;

  const hideAddYAxisButtons =
    [DisplayType.LINE, DisplayType.AREA, DisplayType.BAR].includes(displayType) &&
    aggregates.length === 3;

  let injectedFunctions: Set<string> = new Set();

  const fieldOptions = datasetConfig.getTableFieldOptions(
    organization,
    tags,
    customMeasurements
  );

  // We need to persist the form values across Errors and Transactions datasets
  // for the discover dataset split, so functions that are not compatible with
  // errors should still appear in the field options to gracefully handle incorrect
  // dataset splitting.
  if (
    hasDatasetSelector(organization) &&
    widgetType &&
    [WidgetType.ERRORS, WidgetType.TRANSACTIONS].includes(widgetType)
  ) {
    injectedFunctions = addIncompatibleFunctions(aggregates, fieldOptions);
  }

  function handleOnFieldSelected(i: number) {
    const newSelectedAggregate = i;
    onChange(aggregates, newSelectedAggregate);
  }

  return (
    <FieldGroup inline={false} flexibleControlStateSize error={fieldError} stacked>
      {/* <SubHeading> {'Visualize'} </SubHeading> */}
      {aggregates.map((fieldValue, i) => (
        <QueryFieldWrapper key={`${fieldValue}:${i}`}>
          {aggregates.length > 1 && (
            <RadioLineItem index={i} role="radio">
              <Radio
                checked={i === selectedAggregate ? true : false}
                onChange={() => handleOnFieldSelected(i)}
              />
            </RadioLineItem>
          )}
          <QueryField
            fieldValue={fieldValue}
            fieldOptions={fieldOptions}
            onChange={value => handleChangeQueryField(value, i)}
            filterPrimaryOptions={option =>
              datasetConfig.filterYAxisOptions?.(displayType)(option) ||
              injectedFunctions.has(`${option.value.kind}:${option.value.meta.name}`)
            }
            filterAggregateParameters={datasetConfig.filterYAxisAggregateParams?.(
              fieldValue,
              displayType
            )}
            otherColumns={aggregates}
            noFieldsMessage={noFieldsMessage}
          />
          {aggregates.length > 1 &&
            (canDelete || fieldValue.kind === FieldValueKind.EQUATION) && (
              <DeleteButton onDelete={event => handleRemoveQueryField(event, i)} />
            )}
        </QueryFieldWrapper>
      ))}

      {!hideAddYAxisButtons && (
        <Actions gap={1}>
          <AddButton
            title={
              displayType === DisplayType.BIG_NUMBER ? t('Add Field') : t('Add Overlay')
            }
            onAdd={handleAddFields}
          />
          {datasetConfig.enableEquations && (
            <AddButton title={t('Add an Equation')} onAdd={handleAddEquation} />
          )}
        </Actions>
      )}

      {/* <SubHeading> {'Customize Visualization (optional)'} </SubHeading>
      <QueryField
        fieldValue={defaultCustomField}
        fieldOptions={fieldOptions}
        onChange={value => {
          defaultCustomField = value;
        }}
        filterPrimaryOptions={option =>
          datasetConfig.filterYAxisOptions?.(displayType)(option) ||
          injectedFunctions.has(`${option.value.kind}:${option.value.meta.name}`)
        }
        filterAggregateParameters={datasetConfig.filterYAxisAggregateParams?.(
          defaultCustomField,
          displayType
        )}
        otherColumns={aggregates}
        noFieldsMessage={noFieldsMessage}
      /> */}
    </FieldGroup>
  );
}

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;

  :not(:last-child) {
    margin-bottom: ${space(1)};
  }

  > * + * {
    margin-left: ${space(1)};
  }
`;

// const SubHeading = styled('h6')`
//   margin-bottom: ${space(1)};
//   color: ${p => p.theme.gray500};
// `;

const Actions = styled(ButtonBar)`
  justify-content: flex-start;
  margin-bottom: ${space(2)};
`;
