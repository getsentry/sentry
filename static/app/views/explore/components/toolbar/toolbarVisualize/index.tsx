import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
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

interface VisualizeDropdownProps {
  aggregateOptions: Array<SelectOption<SelectKey>>;
  canDelete: boolean;
  fieldOptions: Array<SelectOption<SelectKey>>;
  onChangeAggregate: (option: SelectOption<SelectKey>) => void;
  onChangeArgument: (option: SelectOption<SelectKey>) => void;
  onDelete: () => void;
  parsedFunction: ParsedFunction | null;
}

export function VisualizeDropdown({
  aggregateOptions,
  canDelete,
  fieldOptions,
  onChangeAggregate,
  onChangeArgument,
  onDelete,
  parsedFunction,
}: VisualizeDropdownProps) {
  return (
    <ToolbarRow>
      <AggregateCompactSelect
        searchable
        options={aggregateOptions}
        value={parsedFunction?.name ?? ''}
        onChange={onChangeAggregate}
      />
      <FieldCompactSelect
        searchable
        options={fieldOptions}
        value={parsedFunction?.arguments[0] ?? ''}
        onChange={onChangeArgument}
        disabled={fieldOptions.length === 1}
      />
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
