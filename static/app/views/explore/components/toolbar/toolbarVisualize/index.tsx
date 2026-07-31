import type {KeyboardEvent, PointerEvent, ReactNode} from 'react';
import {useCallback, useRef} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button, type ButtonProps} from '@sentry/scraps/button';
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
      <Stack
        flex="1"
        minWidth="0"
        gap="sm"
        // Allow the filter to overflow the toolbar when expanded on focus.
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

const PAGE_EDGE_PADDING_PX = 16;

function focusInputAtEnd(input: HTMLInputElement) {
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

export function ExpandableFilterSearchBar({children}: {children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);

  const expandToPageWidth = useCallback(() => {
    const el = ref.current;
    if (!el || el.dataset.expanded === 'true') {
      return;
    }
    const {left} = el.getBoundingClientRect();
    // Expand instantly so focus/caret aren't racing the width animation.
    el.style.transition = 'none';
    el.style.width = `${document.documentElement.clientWidth - left - PAGE_EDGE_PADDING_PX}px`;
    el.dataset.expanded = 'true';
    // Restore transition for collapse.
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.style.transition = '';
      }
    });
  }, []);

  const collapseToDefaultWidth = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.style.width = '';
    delete el.dataset.expanded;
  }, []);

  const isSuggestionMenuOpen = useCallback(() => {
    return Boolean(ref.current?.querySelector('[role="combobox"][aria-expanded="true"]'));
  }, []);

  const collapseAfterBlur = useCallback(() => {
    // Defer past menu close / focus handoff. Suggestion menus may briefly keep
    // aria-expanded while focus leaves; a second frame lets that settle.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el || el.contains(document.activeElement)) {
          return;
        }
        // Keep expanded while this bar's autocomplete is open (incl. portaled menus).
        if (isSuggestionMenuOpen()) {
          return;
        }
        collapseToDefaultWidth();
      });
    });
  }, [collapseToDefaultWidth, isSuggestionMenuOpen]);

  const focusTrailingInput = useCallback(() => {
    const input = ref.current?.querySelector<HTMLInputElement>(
      '[data-test-id="query-builder-input"]'
    );
    if (!input) {
      return;
    }

    // Focus the grid row first so React Aria updates focusedKey, then the
    // free-text input. Focusing the input alone can leave focusedKey on a
    // filter chip, which steals focus back (no caret until a second click).
    const row = input.closest<HTMLElement>('[role="row"]');
    row?.focus();
    focusInputAtEnd(input);
  }, []);

  const onPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) {
        return;
      }

      // Already expanded — only route empty chrome clicks to the trailing input.
      if (el.dataset.expanded === 'true') {
        const target = event.target;
        if (
          target instanceof Element &&
          !target.closest('input, textarea, button, [role="button"]')
        ) {
          event.preventDefault();
          focusTrailingInput();
        }
        return;
      }

      // Collapsed (often multi-row): expanding reflows tokens out from under the
      // pointer, so the browser can't place focus/caret reliably. Intentionally
      // take over the first click — expand and put the caret at the end of the
      // trailing free-text input. Filter chips can be edited on a subsequent click.
      event.preventDefault();
      expandToPageWidth();
      focusTrailingInput();
      // Re-assert after layout in case the grid steals focus during reflow.
      requestAnimationFrame(() => {
        focusTrailingInput();
      });
    },
    [expandToPageWidth, focusTrailingInput]
  );

  const dismissOnEnter = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
        return;
      }

      // Selecting an autocomplete option also uses Enter; keep the bar expanded
      // while a suggestion menu is open.
      if (isSuggestionMenuOpen()) {
        return;
      }

      const active = document.activeElement;
      if (active instanceof HTMLElement && ref.current?.contains(active)) {
        active.blur();
      }
      collapseToDefaultWidth();
    },
    [collapseToDefaultWidth, isSuggestionMenuOpen]
  );

  return (
    <ExpandableFilterSearchBarWrapper
      ref={ref}
      onPointerDownCapture={onPointerDownCapture}
      onFocusCapture={expandToPageWidth}
      onBlurCapture={collapseAfterBlur}
      onKeyDownCapture={dismissOnEnter}
    >
      {children}
    </ExpandableFilterSearchBarWrapper>
  );
}

const ExpandableFilterSearchBarWrapper = styled('div')`
  width: 100%;
  min-width: 0;
  position: relative;
  /* Clip long tokens when collapsed; allow dropdown overlays to escape when expanded. */
  overflow: hidden;
  transition: width ${p => p.theme.motion.smooth.moderate};

  [data-test-id='search-query-builder'] {
    max-width: 100%;
    resize: none;
  }

  /* Measuring overlay sits above the input and steals caret-placement clicks. */
  [data-hidden-text] {
    pointer-events: none;
  }

  &[data-expanded='true'],
  &:focus-within {
    overflow: visible;
    z-index: ${p => p.theme.zIndex.dropdown};

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
