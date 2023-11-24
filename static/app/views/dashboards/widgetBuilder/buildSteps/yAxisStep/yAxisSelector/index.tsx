import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {TagCollection} from 'sentry/types';
import {QueryFieldValue} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboards/types';
import {QueryField} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import {useTableFieldOptions} from '../../../utils';

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

  const fieldOptions = useTableFieldOptions(organization, tags, widgetType);

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

  return (
    <FieldGroup inline={false} flexibleControlStateSize error={fieldError} stacked>
      {aggregates.map((fieldValue, i) => (
        <QueryFieldWrapper key={`${fieldValue}:${i}`}>
          <QueryField
            fieldValue={fieldValue}
            fieldOptions={fieldOptions}
            onChange={value => handleChangeQueryField(value, i)}
            filterPrimaryOptions={datasetConfig.filterYAxisOptions?.(displayType)}
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

      {/* TODO(ddm): support multiple overlays */}
      {!hideAddYAxisButtons && widgetType !== WidgetType.METRICS && (
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
