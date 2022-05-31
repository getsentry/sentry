import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import Field from 'sentry/components/forms/field';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  aggregateFunctionOutputType,
  isLegalYAxisType,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  doNotValidateYAxis,
  filterPrimaryOptions,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';
import {FieldValueOption, QueryField} from 'sentry/views/eventsV2/table/queryField';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {AddButton} from './addButton';
import {DeleteButton} from './deleteButton';

interface Props {
  aggregates: QueryFieldValue[];
  displayType: DisplayType;
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  /**
   * Fired when aggregates are added/removed/modified/reordered.
   */
  onChange: (aggregates: QueryFieldValue[]) => void;
  widgetType: Widget['widgetType'];
  errors?: Record<string, any>;
  noFieldsMessage?: string;
}

export function YAxisSelector({
  displayType,
  widgetType,
  aggregates,
  fieldOptions,
  onChange,
  errors,
  noFieldsMessage,
}: Props) {
  const organization = useOrganization();
  const isReleaseWidget = widgetType === WidgetType.RELEASE;

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

  function handleTopNChangeField(value: QueryFieldValue) {
    // Top N widgets can only ever change a single y-axis
    onChange([value]);
  }

  function filterAggregateParameters(fieldValue: QueryFieldValue) {
    return (option: FieldValueOption) => {
      if (isReleaseWidget) {
        if (option.value.kind === FieldValueKind.METRICS) {
          return true;
        }
        return false;
      }

      // Only validate function parameters for timeseries widgets and
      // world map widgets.
      if (doNotValidateYAxis(displayType)) {
        return true;
      }

      if (fieldValue.kind !== FieldValueKind.FUNCTION) {
        return true;
      }

      const functionName = fieldValue.function[0];
      const primaryOutput = aggregateFunctionOutputType(
        functionName as string,
        option.value.meta.name
      );
      if (primaryOutput) {
        return isLegalYAxisType(primaryOutput);
      }

      if (
        option.value.kind === FieldValueKind.FUNCTION ||
        option.value.kind === FieldValueKind.EQUATION
      ) {
        // Functions and equations are not legal options as an aggregate/function parameter.
        return false;
      }

      return isLegalYAxisType(option.value.meta.dataType);
    };
  }

  const fieldError = errors?.find(error => error?.aggregates)?.aggregates;

  if (displayType === DisplayType.TOP_N) {
    const fieldValue = aggregates[aggregates.length - 1];
    return (
      <Field inline={false} flexibleControlStateSize error={fieldError} stacked>
        <QueryFieldWrapper>
          <QueryField
            fieldValue={fieldValue}
            fieldOptions={generateFieldOptions({organization})}
            onChange={handleTopNChangeField}
            filterPrimaryOptions={option =>
              filterPrimaryOptions({
                option,
                widgetType,
                displayType,
              })
            }
            filterAggregateParameters={filterAggregateParameters(fieldValue)}
          />
        </QueryFieldWrapper>
      </Field>
    );
  }

  const canDelete = aggregates.length > 1;

  const hideAddYAxisButtons =
    ([DisplayType.WORLD_MAP, DisplayType.BIG_NUMBER].includes(displayType) &&
      aggregates.length === 1) ||
    ([DisplayType.LINE, DisplayType.AREA, DisplayType.BAR].includes(displayType) &&
      aggregates.length === 3);

  return (
    <Field inline={false} flexibleControlStateSize error={fieldError} stacked>
      {aggregates.map((fieldValue, i) => (
        <QueryFieldWrapper key={`${fieldValue}:${i}`}>
          <QueryField
            fieldValue={fieldValue}
            fieldOptions={fieldOptions}
            onChange={value => handleChangeQueryField(value, i)}
            filterPrimaryOptions={option =>
              filterPrimaryOptions({
                option,
                widgetType,
                displayType,
              })
            }
            filterAggregateParameters={filterAggregateParameters(fieldValue)}
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
          {!isReleaseWidget && (
            <AddButton title={t('Add an Equation')} onAdd={handleAddEquation} />
          )}
        </Actions>
      )}
    </Field>
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
