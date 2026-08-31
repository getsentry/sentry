import type {ReactNode} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {IconAdd} from 'sentry/icons';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import type {ParsedFunction} from 'sentry/utils/discover/fields';
import {getFieldDefinition, type GetFieldDefinitionType} from 'sentry/utils/fields';
import {
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
} from 'sentry/views/explore/components/toolbar/styles';
import {ExpandableFilterSearchBar} from 'sentry/views/explore/components/toolbar/toolbarVisualize/expandableFilterSearchBar';
import {sortSearchedAttributes} from 'sentry/views/explore/utils/sortSearchedAttributes';

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
  fieldOptions: Array<SelectOption<SelectKey>>;
  onChangeAggregate: (option: SelectOption<SelectKey>) => void;
  onChangeArgument: (index: number, option: SelectOption<SelectKey>) => void;
  parsedFunction: ParsedFunction | null;
  deleteLabel?: string;
  dragColumnId?: number;
  fieldDefinitionType?: GetFieldDefinitionType;
  /**
   * Search bar rendered underneath the aggregate dropdowns, used to attach an `_if`
   * filter to this series.
   */
  filterSearchBar?: ReactNode;
  label?: ReactNode;
  loading?: boolean;
  onClose?: () => void;
  onDelete?: () => void;
  onSearch?: (search: string) => void;
}

export function ToolbarVisualizeDropdown({
  dragColumnId,
  aggregateOptions,
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
  fieldDefinitionType = 'span',
}: ToolbarVisualizeDropdownProps) {
  const {attributes, listeners, setNodeRef, transform} = useSortable({
    id: dragColumnId ?? 0,
    transition: null,
  });

  const aggregateFunc = parsedFunction?.name;
  const aggregateDefinition = aggregateFunc
    ? getFieldDefinition(aggregateFunc, 'span')
    : undefined;

  return (
    <ToolbarRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        // Keep the drag handle, label and delete button aligned with the dropdowns
        // rather than centered against the taller filter bar row.
        ...(filterSearchBar ? {alignItems: 'flex-start'} : null),
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
          <AggregateCompactSelect
            search
            options={aggregateOptions}
            value={parsedFunction?.name ?? ''}
            onChange={onChangeAggregate}
          />
          {aggregateDefinition?.parameters?.map((param, index) => {
            return (
              <FieldCompactSelect
                key={param.name}
                search={{
                  highlight: true,
                  onChange: onSearch,
                  filter: (option, searchText) => {
                    return sortSearchedAttributes({
                      fieldDefinitionType,
                      option,
                      searchText,
                    });
                  },
                }}
                options={fieldOptions}
                value={parsedFunction?.arguments[index] ?? param.defaultValue ?? ''}
                onChange={option => onChangeArgument(index, option)}
                disabled={fieldOptions.length === 1}
                onClose={onClose}
                loading={loading}
              />
            );
          })}
          {aggregateDefinition?.parameters?.length === 0 && ( // for parameterless functions, we want to still show show greyed out spans
            <FieldCompactSelect
              search={{
                highlight: true,
                onChange: onSearch,
                filter: (option, searchText) => {
                  return sortSearchedAttributes({
                    fieldDefinitionType,
                    option,
                    searchText,
                  });
                },
              }}
              options={fieldOptions}
              value={parsedFunction?.arguments[0] ?? ''}
              onChange={option => onChangeArgument(0, option)}
              disabled
              onClose={onClose}
              loading={loading}
            />
          )}
        </Flex>
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

  > button {
    width: 100%;
  }
`;
