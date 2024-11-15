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
    if (displayType === DisplayType.BIG_NUMBER) {
      onChange(newAggregates, newAggregates.length - 1);
    } else {
      onChange(newAggregates);
    }
  }

  function handleAddEquation(event: React.MouseEvent) {
    event.preventDefault();

    const newAggregates = [
      ...aggregates,
      {kind: FieldValueKind.EQUATION, field: ''} as QueryFieldValue,
    ];
    if (displayType === DisplayType.BIG_NUMBER) {
      const newSelectedAggregate = newAggregates.length - 1;
      onChange(newAggregates, newSelectedAggregate);
    } else {
      onChange(newAggregates);
    }
  }

  function handleRemoveQueryField(event: React.MouseEvent, fieldIndex: number) {
    event.preventDefault();

    const newAggregates = [...aggregates];
    newAggregates.splice(fieldIndex, 1);
    if (displayType === DisplayType.BIG_NUMBER) {
      const newSelectedAggregate = newAggregates.length - 1;
      onChange(newAggregates, newSelectedAggregate);
    } else {
      onChange(newAggregates);
    }
  }

  function handleChangeQueryField(value: QueryFieldValue, fieldIndex: number) {
    const newAggregates = [...aggregates];
    newAggregates[fieldIndex] = value;
    onChange(newAggregates);
  }

  function handleSelectField(newSelectedAggregate: number) {
    onChange(aggregates, newSelectedAggregate);
  }

  const fieldError = errors?.find(error => error?.aggregates)?.aggregates;
  const canDelete = aggregates.length > 1;

  const hideAddYAxisButtons =
    ([DisplayType.LINE, DisplayType.AREA, DisplayType.BAR].includes(displayType) &&
      aggregates.length === 3) ||
    (displayType === DisplayType.BIG_NUMBER && widgetType === WidgetType.RELEASE);

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

  return (
    <FieldGroup inline={false} flexibleControlStateSize error={fieldError} stacked>
      {aggregates.map((fieldValue, i) => (
        <QueryFieldWrapper key={`${fieldValue}:${i}`}>
          {aggregates.length > 1 && displayType === DisplayType.BIG_NUMBER && (
            <RadioLineItem index={i} role="radio" aria-label="aggregate-selector">
              <Radio
                checked={i === selectedAggregate}
                onChange={() => handleSelectField(i)}
                aria-label={'field' + i}
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
              displayType === DisplayType.BIG_NUMBER ? t('Add Field') : t('Add Series')
            }
            onAdd={handleAddFields}
          />
          {datasetConfig.enableEquations && (
            <AddButton title={t('Add an Equation')} onAdd={handleAddEquation} />
          )}
        </Actions>
      )}
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

const Actions = styled(ButtonBar)`
  justify-content: flex-start;
`;
