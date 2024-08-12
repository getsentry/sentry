import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {getFieldOptionFormat} from 'sentry/views/dashboards/widgetBuilder/utils';
import {appendFieldIfUnknown, QueryField} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import {AddButton} from './addButton';
import {DeleteButton} from './deleteButton';

interface Props {
  aggregates: QueryFieldValue[];
  displayType: DisplayType;
  /**
   * Fired when aggregates are added/removed/modified/reordered.
   */
  onChange: (aggregates: QueryFieldValue[]) => void;
  tags: TagCollection;
  widgetType: Widget['widgetType'];
  errors?: Record<string, any>;
  noFieldsMessage?: string;
}

export function YAxisSelector({
  displayType,
  widgetType,
  aggregates,
  tags,
  onChange,
  errors,
  noFieldsMessage,
}: Props) {
  const organization = useOrganization();
  const datasetConfig = getDatasetConfig(widgetType);

  const {customMeasurements} = useCustomMeasurements();

  function handleAddOverlay(event: React.MouseEvent) {
    event.preventDefault();

    const newAggregates = [
      ...aggregates,
      {kind: FieldValueKind.FIELD, field: ''} as QueryFieldValue,
    ];
    onChange(newAggregates);
  }

  function handleAddEquation(event: React.MouseEvent) {
    event.preventDefault();

    const newAggregates = [
      ...aggregates,
      {kind: FieldValueKind.EQUATION, field: ''} as QueryFieldValue,
    ];
    onChange(newAggregates);
  }

  function handleRemoveQueryField(event: React.MouseEvent, fieldIndex: number) {
    event.preventDefault();

    const newAggregates = [...aggregates];
    newAggregates.splice(fieldIndex, 1);
    onChange(newAggregates);
  }

  function handleChangeQueryField(value: QueryFieldValue, fieldIndex: number) {
    const newAggregates = [...aggregates];
    newAggregates[fieldIndex] = value;
    onChange(newAggregates);
  }

  const fieldError = errors?.find(error => error?.aggregates)?.aggregates;
  const canDelete = aggregates.length > 1;

  const hideAddYAxisButtons =
    (DisplayType.BIG_NUMBER === displayType && aggregates.length === 1) ||
    ([DisplayType.LINE, DisplayType.AREA, DisplayType.BAR].includes(displayType) &&
      aggregates.length === 3);

  const injectedFunctions = new Set();

  let fieldOptions = datasetConfig.getTableFieldOptions(
    organization,
    tags,
    customMeasurements
  );

  // We need to persist the form values across Errors and Transactions datasets
  // for the discover dataset split, so functions that are not compatible with
  // errors should still appear in the field options to gracefully handle incorrect
  // dataset splitting.
  if (widgetType && [WidgetType.ERRORS, WidgetType.TRANSACTIONS].includes(widgetType)) {
    aggregates.forEach(field => {
      // Inject functions that aren't compatible with the current dataset
      if (field.kind === 'function') {
        const functionName = field.alias || field.function[0];
        if (!(`function:${functionName}` in fieldOptions)) {
          const formattedField = getFieldOptionFormat(field);
          if (formattedField) {
            const [key, value] = formattedField;
            fieldOptions[key] = value;

            // Store the injected function key so we can ensure the aggregate is visible
            injectedFunctions.add(key);

            // If the function needs to be injected, inject the parameter as a tag
            // as well if it isn't already an option
            if (
              field.function[1] &&
              !fieldOptions[`field:${field.function[1]}`] &&
              !fieldOptions[`tag:${field.function[1]}`]
            ) {
              fieldOptions = appendFieldIfUnknown(fieldOptions, {
                kind: FieldValueKind.TAG,
                meta: {
                  dataType: 'string',
                  name: field.function[1],
                  unknown: true,
                },
              });
            }
          }
        }
      }
    });
  }

  return (
    <FieldGroup inline={false} flexibleControlStateSize error={fieldError} stacked>
      {aggregates.map((fieldValue, i) => (
        <QueryFieldWrapper key={`${fieldValue}:${i}`}>
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
          <AddButton title={t('Add Overlay')} onAdd={handleAddOverlay} />
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
