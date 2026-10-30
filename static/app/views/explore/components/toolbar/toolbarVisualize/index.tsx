import type {ReactNode} from 'react';
import {useState} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';
import {IconAdd} from '@sentry/icons/add';
import {IconDelete} from '@sentry/icons/delete';

import {Button} from '@sentry/scraps/button';
import type {
  SelectKey,
  SelectOption,
  SelectOptionOrSection,
  SelectOptionWithKey,
} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {t} from 'sentry/locale';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {
  FieldKind,
  getFieldDefinition,
  type GetFieldDefinitionType,
} from 'sentry/utils/fields';
import {
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
} from 'sentry/views/explore/components/toolbar/styles';
import {ExpandableFilterSearchBar} from 'sentry/views/explore/components/toolbar/toolbarVisualize/expandableFilterSearchBar';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';
import type {SavedFormula} from 'sentry/views/explore/hooks/useGetSavedFormulas';
import {stripNamePrefix} from 'sentry/views/explore/savedFormulas/formulaBuilder/draft';
import {
  buildFormulaYAxis,
  findFormula,
  getFormulaArgumentParams,
} from 'sentry/views/explore/utils/formulaAggregate';
import {sortSearchedAttributes} from 'sentry/views/explore/utils/sortSearchedAttributes';

const NO_FORMULAS: SavedFormula[] = [];

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
  fieldOptions: Array<SelectOption<SelectKey>>;
  onChangeArgument: (index: number, value: string) => void;
  parsedFunction: ParsedFunction | null;
  aggregateOptions?: Array<SelectOption<SelectKey>>;
  /**
   * Replaces the default single-select aggregate dropdown, e.g. to allow
   * selecting several aggregates at once.
   */
  aggregateSelect?: ReactNode;
  deleteLabel?: string;
  dragColumnId?: number;
  fieldDefinitionType?: GetFieldDefinitionType;
  /**
   * Search bar rendered underneath the aggregate dropdowns, used to attach an `_if`
   * filter to this series.
   */
  filterSearchBar?: ReactNode;
  formulaDefaultColumn?: string | null;
  formulas?: readonly SavedFormula[];
  label?: ReactNode;
  loading?: boolean;
  onChangeAggregate?: (option: SelectOption<SelectKey>) => void;
  onClose?: () => void;
  onDelete?: () => void;
  onSearch?: (search: string) => void;
}

export function ToolbarVisualizeDropdown({
  dragColumnId,
  aggregateOptions = [],
  aggregateSelect,
  fieldOptions,
  onChangeAggregate,
  onChangeArgument,
  onDelete,
  deleteLabel,
  onSearch,
  onClose,
  parsedFunction,
  label,
  loading,
  filterSearchBar,
  formulaDefaultColumn = null,
  formulas = NO_FORMULAS,
  fieldDefinitionType = 'span',
}: ToolbarVisualizeDropdownProps) {
  const {attributes, listeners, setNodeRef, transform} = useSortable({
    id: dragColumnId ?? 0,
    transition: null,
  });

  const aggregateFunc = parsedFunction?.name;
  const formula = findFormula(formulas, aggregateFunc);
  const aggregateDefinition =
    aggregateFunc && !formula ? getFieldDefinition(aggregateFunc, 'span') : undefined;

  const functionOptions = aggregateOptions.map(option => ({
    ...option,
    trailingItems: <TypeBadge kind={FieldKind.FUNCTION} />,
  }));
  const allAggregateOptions: Array<SelectOptionOrSection<SelectKey>> = formulas.length
    ? [
        {key: 'functions', label: t('Functions'), options: functionOptions},
        {
          key: 'formulas',
          label: t('Formulas'),
          options: formulas.map(savedFormula => ({
            label: stripNamePrefix(savedFormula.name),
            value: savedFormula.name,
            textValue: savedFormula.name,
            disabled: buildFormulaYAxis(savedFormula, formulaDefaultColumn) === null,
            trailingItems: <TypeBadge kind={FieldKind.FUNCTION} />,
          })),
        },
      ]
    : functionOptions;

  const fieldSearch = {
    highlight: true,
    onChange: onSearch,
    filter: (option: SelectOptionWithKey<SelectKey>, searchText: string) =>
      sortSearchedAttributes({fieldDefinitionType, option, searchText}),
  };

  const onChangeField = (index: number, option: SelectOption<SelectKey>) => {
    if (typeof option.value === 'string') {
      onChangeArgument(index, option.value);
    }
  };

  return (
    <ToolbarRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        // Keep the drag handle, label and delete button aligned with the dropdowns
        // rather than centered against the taller filter bar row.
        ...(filterSearchBar || formula ? {alignItems: 'flex-start'} : null),
      }}
      {...attributes}
    >
      {dragColumnId === undefined ? null : (
        <DragReorderButton iconSize="sm" {...listeners} />
      )}
      {label}
      <Stack
        flex="1"
        minWidth="0"
        gap="sm"
        // Let the filter bar overflow the toolbar once it expands on focus.
        overflow="visible"
      >
        <Flex gap="md" align="center" width="100%">
          {aggregateSelect ??
            (formula ? (
              <FieldCompactSelect
                search
                options={allAggregateOptions}
                value={parsedFunction?.name ?? ''}
                onChange={option => onChangeAggregate?.(option)}
              />
            ) : (
              <AggregateCompactSelect
                search
                options={allAggregateOptions}
                value={parsedFunction?.name ?? ''}
                onChange={option => onChangeAggregate?.(option)}
              />
            ))}
          {aggregateDefinition?.parameters?.map((param, index) => {
            return (
              <FieldCompactSelect
                key={param.name}
                search={fieldSearch}
                options={fieldOptions}
                value={parsedFunction?.arguments[index] ?? param.defaultValue ?? ''}
                onChange={option => onChangeField(index, option)}
                disabled={fieldOptions.length === 1}
                onClose={onClose}
                loading={loading}
              />
            );
          })}
          {aggregateDefinition?.parameters?.length === 0 && ( // for parameterless functions, we want to still show show greyed out spans
            <FieldCompactSelect
              search={fieldSearch}
              options={fieldOptions}
              value={parsedFunction?.arguments[0] ?? ''}
              onChange={option => onChangeField(0, option)}
              disabled
              onClose={onClose}
              loading={loading}
            />
          )}
        </Flex>
        {formula
          ? getFormulaArgumentParams(formula).map((param, index) =>
              param.type === 'number' ? (
                <FormulaNumberInput
                  key={param.name}
                  name={param.name}
                  value={parsedFunction?.arguments[index] ?? ''}
                  onChange={value => onChangeArgument(index, value)}
                />
              ) : (
                <FieldCompactSelect
                  key={param.name}
                  search={fieldSearch}
                  options={fieldOptions}
                  value={parsedFunction?.arguments[index] ?? ''}
                  onChange={option => onChangeField(index, option)}
                  onClose={onClose}
                  loading={loading}
                  trigger={triggerProps => (
                    <OverlayTrigger.Button
                      {...triggerProps}
                      prefix={param.name}
                      aria-label={param.name}
                    />
                  )}
                />
              )
            )
          : null}
        {filterSearchBar ? (
          <ExpandableFilterSearchBar>{filterSearchBar}</ExpandableFilterSearchBar>
        ) : null}
      </Stack>
      {onDelete ? (
        <Button
          variant="transparent"
          icon={<IconDelete size="sm" />}
          size="zero"
          onClick={onDelete}
          aria-label={deleteLabel ?? t('Remove Overlay')}
        />
      ) : null}
    </ToolbarRow>
  );
}

interface ToolbarVisualizeAddProps {
  add: () => void;
  disabled: boolean;
  display?: 'button' | 'link';
  label?: string;
}

export function ToolbarVisualizeAddChart({
  add,
  disabled,
  label,
  display = 'link',
}: ToolbarVisualizeAddProps) {
  return (
    <ToolbarFooterButton
      size={display === 'link' ? 'zero' : 'md'}
      icon={<IconAdd />}
      onClick={add}
      variant={display === 'link' ? 'link' : undefined}
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
      variant="link"
      aria-label={t('Add Equation')}
      disabled={disabled}
    >
      {t('Add Equation')}
    </ToolbarFooterButton>
  );
}

function FormulaNumberInput({
  name,
  value,
  onChange,
}: {
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [draft, setDraft] = useState(value);
  const [committed, setCommitted] = useState(value);
  if (value !== committed) {
    setCommitted(value);
    setDraft(value);
  }

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === value) {
      return;
    }
    if (trimmed === '' || !Number.isFinite(Number(trimmed))) {
      setDraft(value);
      return;
    }
    onChange(trimmed);
  };

  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <Text variant="muted">{name}</Text>
      </InputGroup.LeadingItems>
      <InputGroup.Input
        type="text"
        inputMode="decimal"
        aria-label={name}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            commit();
          }
        }}
      />
    </InputGroup>
  );
}

const AggregateCompactSelect = styled(CompactSelect)`
  width: 100px;
  flex-shrink: 0;

  > button {
    width: 100%;
  }
`;

const FieldCompactSelect = styled(CompactSelect)`
  flex: 1 1;
  min-width: 0;
  width: 100%;

  > button {
    width: 100%;
  }
`;
