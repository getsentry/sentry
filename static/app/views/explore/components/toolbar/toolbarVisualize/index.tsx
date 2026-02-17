import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconAdd} from 'sentry/icons';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {getFieldDefinition} from 'sentry/utils/fields';
import {
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
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
  aggregateValue: string | string[];
  canDelete: boolean;
  fieldOptions: Array<SelectOption<SelectKey>>;
  onChangeAggregate: (
    option: SelectOption<SelectKey> | Array<SelectOption<SelectKey>>
  ) => void;
  onChangeArgument: (index: number, option: SelectOption<SelectKey>) => void;
  onDelete: () => void;
  parsedFunction: ParsedFunction | null;
  aggregateMultiple?: boolean;
  label?: ReactNode;
  loading?: boolean;
  onClose?: () => void;
  onSearch?: (search: string) => void;
}

export function ToolbarVisualizeDropdown({
  aggregateMultiple = false,
  aggregateOptions,
  aggregateValue,
  canDelete,
  fieldOptions,
  onChangeAggregate,
  onChangeArgument,
  onDelete,
  onSearch,
  onClose,
  parsedFunction,
  label,
  loading,
}: ToolbarVisualizeDropdownProps) {
  const aggregateFunc = parsedFunction?.name;
  const aggregateDefinition = aggregateFunc
    ? getFieldDefinition(aggregateFunc, 'span')
    : undefined;

  const singleAggregateValue = Array.isArray(aggregateValue)
    ? (aggregateValue[0] ?? '')
    : aggregateValue;
  const multiAggregateValue = Array.isArray(aggregateValue)
    ? aggregateValue
    : aggregateValue
      ? [aggregateValue]
      : [];

  return (
    <ToolbarRow>
      {label}
      {aggregateMultiple ? (
        <AggregateCompactSelect
          multiple
          searchable
          options={aggregateOptions}
          value={multiAggregateValue}
          onChange={options => onChangeAggregate(options)}
        />
      ) : (
        <AggregateCompactSelect
          searchable
          options={aggregateOptions}
          value={singleAggregateValue}
          onChange={option => onChangeAggregate(option)}
        />
      )}
      {aggregateDefinition?.parameters?.map((param, index) => {
        return (
          <FieldCompactSelect
            key={param.name}
            searchable
            options={fieldOptions}
            value={parsedFunction?.arguments[index] ?? param.defaultValue ?? ''}
            onChange={option => onChangeArgument(index, option)}
            disabled={fieldOptions.length === 1}
            onSearch={onSearch}
            onClose={onClose}
            loading={loading}
          />
        );
      })}
      {aggregateDefinition?.parameters?.length === 0 && ( // for parameterless functions, we want to still show show greyed out spans
        <FieldCompactSelect
          searchable
          options={fieldOptions}
          value={parsedFunction?.arguments[0] ?? ''}
          onChange={option => onChangeArgument(0, option)}
          disabled
          onSearch={onSearch}
          onClose={onClose}
          loading={loading}
        />
      )}
      {canDelete ? (
        <Button
          priority="transparent"
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
  label?: string;
}

export function ToolbarVisualizeAddChart({
  add,
  disabled,
  label,
}: ToolbarVisualizeAddProps) {
  return (
    <ToolbarFooterButton
      size="zero"
      icon={<IconAdd />}
      onClick={add}
      priority="link"
      aria-label={label ?? t('Add Chart')}
      disabled={disabled}
    >
      {label ?? t('Add Chart')}
    </ToolbarFooterButton>
  );
}

export function ToolbarVisualizeAddEquation({add, disabled}: ToolbarVisualizeAddProps) {
  return (
    <ToolbarFooterButton
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
