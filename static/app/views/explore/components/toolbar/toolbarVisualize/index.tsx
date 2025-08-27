import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import type {ColumnType, ParsedFunction} from 'sentry/utils/discover/fields';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATE_DEFINITIONS,
  type AggregateParameter,
} from 'sentry/utils/fields';
import {BufferedInput} from 'sentry/views/discover/table/queryField';
import {
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
  TwoColumnRow,
} from 'sentry/views/explore/components/toolbar/styles';

export function ToolbarVisualizeHeader() {
  return (
    <ToolbarHeader>
      <Tooltip
        position="right"
        title={t(
          'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
        )}
      >
        <ToolbarLabel>{t('Visualize')}</ToolbarLabel>
      </Tooltip>
    </ToolbarHeader>
  );
}

interface ToolbarVisualizeDropdownProps {
  aggregateOptions: Array<SelectOption<SelectKey>>;
  canDelete: boolean;
  fieldOptions: Array<SelectOption<SelectKey>>;
  onChangeAggregate: (option: SelectOption<SelectKey>) => void;
  onChangeArgument: (index: number, value: string) => void;
  onDelete: () => void;
  parsedFunction: ParsedFunction | null;
}

export function ToolbarVisualizeDropdown({
  aggregateOptions,
  canDelete,
  fieldOptions,
  onChangeAggregate,
  onChangeArgument,
  onDelete,
  parsedFunction,
}: ToolbarVisualizeDropdownProps) {
  const aggregateFunc = parsedFunction?.name;
  const aggregateFuncArgs = parsedFunction?.arguments;
  const aggregate = aggregateFunc
    ? ALLOWED_EXPLORE_VISUALIZE_AGGREGATE_DEFINITIONS[aggregateFunc as AggregationKey]
    : undefined;
  console.log(aggregate);

  return (
    <ToolbarRow>
      <TwoColumnRow>
        <AggregateCompactSelect
          searchable
          options={aggregateOptions}
          value={parsedFunction?.name ?? ''}
          onChange={onChangeAggregate}
        />
        {aggregate?.parameters?.map((param, index) => {
          if (param.kind === 'value') {
            const inputProps = {
              required: param.required,
              value: aggregateFuncArgs?.[index] || param.defaultValue || '',
              onUpdate: (value: string) => {
                onChangeArgument(index, value);
              },
              placeholder: param.placeholder,
            };
            switch (param.dataType) {
              case 'number':
                return (
                  <BufferedInput
                    name="refinement"
                    key={`parameter:number:${index}`}
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
                    key={`parameter:integer:${index}`}
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
                    key={`parameter:text:${index}`}
                    type="text"
                    {...inputProps}
                  />
                );
            }
          }
          return (
            <FieldCompactSelect
              key={param.name}
              searchable
              options={fieldOptions}
              value={parsedFunction?.arguments[0] ?? ''}
              onChange={option => onChangeArgument(index, option.value as string)}
              disabled={fieldOptions.length === 1}
            />
          );
        })}
      </TwoColumnRow>
      {canDelete ? (
        <Button
          borderless
          icon={<IconDelete />}
          size="zero"
          onClick={onDelete}
          aria-label={t('Remove Overlay')}
        />
      ) : null}
    </ToolbarRow>
  );
}

interface ToolbarVisualizeAddProps {
  add: () => void;
  disabled: boolean;
}

export function ToolbarVisualizeAddChart({add, disabled}: ToolbarVisualizeAddProps) {
  return (
    <ToolbarFooterButton
      borderless
      size="zero"
      icon={<IconAdd />}
      onClick={add}
      priority="link"
      aria-label={t('Add Chart')}
      disabled={disabled}
    >
      {t('Add Chart')}
    </ToolbarFooterButton>
  );
}

export function ToolbarVisualizeAddEquation({add, disabled}: ToolbarVisualizeAddProps) {
  return (
    <ToolbarFooterButton
      borderless
      size="zero"
      icon={<IconAdd />}
      onClick={add}
      priority="link"
      aria-label={t('Add Equation')}
      disabled={disabled}
    >
      {t('Add Equation')}
    </ToolbarFooterButton>
  );
}

const AggregateCompactSelect = styled(CompactSelect)`
  width: 100px;

  > button {
    width: 100%;
  }
`;

const FieldCompactSelect = styled(CompactSelect)`
  flex: 1 1;
  min-width: 0;

  > button {
    width: 100%;
  }
`;
