import type {ReactNode} from 'react';
import {useCallback, useRef} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
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
  dragColumnId?: number;
  fieldDefinitionType?: GetFieldDefinitionType;
  /**
   * Optional search bar rendered below the aggregate/argument dropdowns.
   * Used by spans to attach a per-visualize `_if` filter.
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
    ? getFieldDefinition(aggregateFunc, fieldDefinitionType)
    : undefined;

  return (
    <ToolbarRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        // Keep drag/label/delete aligned to the dropdowns when a filter bar is present.
        ...(filterSearchBar ? {alignItems: 'flex-start'} : null),
      }}
      {...attributes}
    >
      {dragColumnId === undefined ? null : (
        <DragReorderButton iconSize="sm" {...listeners} />
      )}
      {label}
      <VisualizeControls>
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
      </VisualizeControls>
      {onDelete ? (
        <Button
          variant="transparent"
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
  display?: 'button' | 'link';
  label?: string;
  size?: ButtonProps['size'];
}

export function ToolbarVisualizeAddChart({
  add,
  disabled,
  label,
  display = 'link',
  size = 'md',
}: ToolbarVisualizeAddProps) {
  return (
    <ToolbarFooterButton
      size={display === 'link' ? 'zero' : size}
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

const VisualizeControls = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: ${p => p.theme.space.sm};
  /* Allow the filter to overflow the toolbar when expanded on focus. */
  overflow: visible;
`;

const PAGE_EDGE_PADDING_PX = 16;

function ExpandableFilterSearchBar({children}: {children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);

  const expandToPageWidth = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const {left} = el.getBoundingClientRect();
    el.style.width = `${document.documentElement.clientWidth - left - PAGE_EDGE_PADDING_PX}px`;
  }, []);

  const collapseToDefaultWidth = useCallback(() => {
    // Defer so focus can settle on portaled menu items without collapsing mid-interaction.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el || el.contains(document.activeElement)) {
        return;
      }
      el.style.width = '';
    });
  }, []);

  return (
    <ExpandableFilterSearchBarWrapper
      ref={ref}
      onFocusCapture={expandToPageWidth}
      onBlurCapture={collapseToDefaultWidth}
    >
      {children}
    </ExpandableFilterSearchBarWrapper>
  );
}

const ExpandableFilterSearchBarWrapper = styled('div')`
  width: 100%;
  min-width: 0;
  position: relative;
  z-index: 0;
  /* Clip long tokens when collapsed; allow dropdown overlays to escape when focused. */
  overflow: hidden;
  transition: width ${p => p.theme.motion.smooth.moderate};

  [data-test-id='search-query-builder'] {
    max-width: 100%;
    /* Input styles default to resize: vertical; disable the corner drag handle. */
    resize: none;
  }

  &:focus-within {
    overflow: visible;
    z-index: ${p => p.theme.zIndex.dropdown};

    /* Override the semi-transparent Input background so content underneath doesn't show through. */
    [data-test-id='search-query-builder'] {
      background-color: ${p => p.theme.tokens.background.primary};
    }
  }
`;

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
