import type * as React from 'react';
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {type CSSObject, useTheme} from '@emotion/react';
import {getFocusableTreeWalker} from '@react-aria/focus';
import {useInteractOutside} from '@react-aria/interactions';
import {getItemId, useListBox} from '@react-aria/listbox';
import {ListKeyboardDelegate, useSelectableCollection} from '@react-aria/selection';
import {mergeRefs, useObjectRef} from '@react-aria/utils';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {Item, Section} from '@react-stately/collections';
import {useListState} from '@react-stately/list';
import type {Key} from '@react-types/shared';

import {Flex} from '@sentry/scraps/layout';
import type {FormSize} from '@sentry/scraps/theme';
import {useTranslation} from '@sentry/scraps/translation';
import {useOverlay} from '@sentry/scraps/useOverlay';
import {
  flattenSections,
  getWidestMenuItemKey,
  useVirtualCollection,
  useVirtualMenuWidth,
} from '@sentry/scraps/useVirtualCollection';

import {SelectChips} from './chips';
import {createFilter} from './filter';
import {SelectIndicators} from './indicators';
import {MENU_GAP, SelectMenu} from './menu';
import {CREATE_KEY, useOptionIndex, type OptionRow} from './options';
import {getSelectStyles} from './styles';
import {applyStyleSlot} from './types';
import type {
  SelectComponents,
  SelectHandle,
  SelectSelectionProps,
  SelectValue,
  StylesConfig,
} from './types';
import {isRenderable} from './utils';

export interface BaseSelectProps<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
  TSelected extends SelectValue<TValue | string> = TOption,
> {
  // Include TValue here so options infer the value type without a selected value.
  options: ReadonlyArray<
    | (TOption & SelectValue<TValue>)
    | {options: ReadonlyArray<TOption & SelectValue<TValue>>; label?: React.ReactNode}
  >;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  autoFocus?: boolean;
  /** Blur after selection. Defaults to true for single selects, false for multiple. */
  blurInputOnSelect?: boolean;
  className?: string;
  /** Customize content while Select retains input, option, and chip behavior. */
  components?: Pick<SelectComponents<TOption>, 'OptionLabel'> &
    Omit<SelectComponents<TSelected>, 'OptionLabel'>;
  /** Allow values that are not in `options`. */
  creatable?: boolean;
  disabled?: boolean;
  /** Set to null to hide the dropdown indicator. */
  dropdownIndicator?: React.ReactNode;
  filterOption?: ((option: TOption, input: string) => boolean) | null;
  formatCreateLabel?: (input: string) => React.ReactNode;
  /** ID of the native input, for association with a label. */
  id?: string;
  /** Ref to the native search input. */
  inputRef?: React.Ref<HTMLInputElement>;
  inputValue?: string;
  isInsideModal?: boolean;
  isLoading?: boolean;
  /** Controlled menu state. */
  isOpen?: boolean;
  /** Compare object values. Values are compared with === by default. */
  isValueEqual?: (a: TValue, b: TValue) => boolean;
  /** Centered content inside the control, before the selected value and input. */
  leadingItems?: React.ReactNode;
  loadingMessage?: () => React.ReactNode;
  maxMenuHeight?: number;
  /** Maximum menu width in pixels, or '100%' to use the control width. */
  maxMenuWidth?: number | '100%';
  /** Align the menu with the start or end edge of the control. Defaults to start. */
  menuAlign?: 'start' | 'end';
  /** Content after the options, outside the scroll container. */
  menuFooter?: React.ReactNode;
  menuPortalTarget?: HTMLElement | null;
  minMenuHeight?: number;
  name?: string;
  noOptionsMessage?: (state: {inputValue: string}) => React.ReactNode;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onCreateOption?: (input: string) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Search text changes, including resets after selection, blur, or menu close. */
  onInputChange?: (input: string, reason: 'input' | 'reset') => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  onOpenChange?: (isOpen: boolean) => void;
  openMenuOnClick?: boolean;
  openMenuOnFocus?: boolean;
  placeholder?: React.ReactNode;
  ref?: React.Ref<SelectHandle>;
  searchable?: boolean;
  showCreateOptionIcon?: boolean;
  showDividers?: boolean;
  size?: FormSize;
  styles?: StylesConfig<NoInfer<TValue | string>, NoInfer<TSelected>>;
  tabIndex?: number;
  /** Content beside the clear button and dropdown indicator. Each item is centered in a slot at least 24px wide. */
  trailingItems?: React.ReactNode;
  /** Virtualize large lists, including lists with sections. */
  virtualized?: boolean;
}

type DisabledSelectionProps<Props extends {onChange: unknown}> = Props extends unknown
  ? Omit<Props, 'onChange'> & {disabled: true; onChange?: Props['onChange']}
  : never;

type SelectionProps<TValue, TOption> =
  | SelectSelectionProps<TValue, TOption>
  | DisabledSelectionProps<SelectSelectionProps<TValue, TOption>>;

type ResolvedOption<TValue, TOption> = TOption | SelectValue<TValue | string>;

export type ControlProps<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
> = BaseSelectProps<TValue, TOption> &
  SelectionProps<TValue, TOption> & {creatable?: false};

export type CreatableControlProps<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
> = BaseSelectProps<TValue, TOption, ResolvedOption<TValue, TOption>> &
  SelectionProps<TValue, ResolvedOption<TValue, TOption>> & {
    creatable: boolean | undefined;
  };

const defaultFilter = createFilter();

function optionText(option: SelectValue<unknown>) {
  return (
    option.textValue ??
    (typeof option.label === 'string' || typeof option.label === 'number'
      ? String(option.label)
      : String(option.value))
  );
}

export function Select<TValue, TOption extends SelectValue<TValue> = SelectValue<TValue>>(
  props: ControlProps<TValue, TOption>
): React.JSX.Element;
export function Select<TValue, TOption extends SelectValue<TValue> = SelectValue<TValue>>(
  props: CreatableControlProps<TValue, TOption>
): React.JSX.Element;
export function Select<TValue, TOption extends SelectValue<TValue> = SelectValue<TValue>>(
  props: ControlProps<TValue, TOption> | CreatableControlProps<TValue, TOption>
): React.JSX.Element;
export function Select<TValue, TOption extends SelectValue<TValue>>(
  props: BaseSelectProps<TValue, TOption, ResolvedOption<TValue, TOption>> &
    SelectionProps<TValue, ResolvedOption<TValue, TOption>>
) {
  const {
    options,
    ref: selectHandleRef,
    inputRef: providedInputRef,
    isLoading,
    dropdownIndicator,
    leadingItems,
    trailingItems,
    placeholder,
    isValueEqual,
    multiple = false,
    clearable = multiple,
    disabled,
    creatable,
    searchable = true,
    styles,
    size = 'md',
    menuAlign = 'start',
    virtualized = false,
    components,
    blurInputOnSelect = !multiple,
    inputValue,
    maxMenuHeight = 300,
    minMenuHeight,
    openMenuOnClick = true,
    openMenuOnFocus = false,
    menuPortalTarget,
    name,
  } = props;
  const {t} = useTranslation();
  const theme = useTheme();
  const inputRef = useObjectRef(providedInputRef);
  const blurFrame = useRef<number | null>(null);
  const selectRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [localQuery, setLocalQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [focusedChip, setFocusedChip] = useState<number | null>(null);
  const [lockedMenuWidth, setLockedMenuWidth] = useState<number>();
  const query = inputValue ?? localQuery;

  const cancelSelectionBlur = useCallback(() => {
    if (blurFrame.current !== null) {
      cancelAnimationFrame(blurFrame.current);
      blurFrame.current = null;
    }
  }, []);

  useEffect(() => cancelSelectionBlur, [cancelSelectionBlur]);

  function updateQuery(value: string, reason: 'input' | 'reset') {
    setLocalQuery(value);
    props.onInputChange?.(value, reason);
  }

  const {
    isOpen,
    state: overlayState,
    overlayRef,
    overlayProps: {ref: setOverlayElement, style: overlayStyle},
    triggerProps: {ref: setTriggerElement},
  } = useOverlay({
    isOpen: disabled ? false : props.isOpen,
    onOpenChange: open => {
      if (open) {
        cancelSelectionBlur();
      } else {
        updateQuery('', 'reset');
      }
      props.onOpenChange?.(open);
    },
    position: `bottom-${menuAlign}`,
    offset: MENU_GAP,
    strategy: menuPortalTarget ? 'fixed' : 'absolute',
    type: 'listbox',
    isKeyboardDismissDisabled: true,
    isDismissable: false,
  });
  if (!isOpen && lockedMenuWidth !== undefined) {
    setLockedMenuWidth(undefined);
  }
  useInteractOutside({
    ref: selectRef,
    isDisabled: !isOpen,
    onInteractOutside: event => {
      if (event.target instanceof Node && !overlayRef.current?.contains(event.target)) {
        overlayState.close();
      }
    },
  });

  const {entries, rows, selectedRows, canCreate} = useOptionIndex(options, {
    creatable,
    isLoading,
    isValueEqual,
    query,
    values: props.multiple ? props.value : [props.value],
  });
  const rowsByKey = new Map<Key, TOption>(rows.map(row => [row.key, row.option]));
  const selectedKeys = selectedRows.flatMap(({key}) => (key === undefined ? [] : [key]));
  const selected = selectedRows.map(({option}) => option);
  const disabledKeys = rows.flatMap(({key, option}) => (option.disabled ? [key] : []));

  function choose(
    key: Key,
    {deselect = false, fromKeyboard = false}: {deselect?: boolean; fromKeyboard?: boolean}
  ) {
    const option = rowsByKey.get(key);
    if (key !== CREATE_KEY && (!option || option.disabled)) {
      return;
    }
    const created = key === CREATE_KEY;
    const choice = option ?? {value: query, label: query};
    setFocusedChip(null);
    if (!multiple && isOpen) {
      overlayState.close();
    } else {
      updateQuery('', 'reset');
    }
    if (created && props.onCreateOption) {
      props.onCreateOption(query);
    } else if (props.multiple) {
      props.onChange?.(
        deselect
          ? selectedRows.filter(row => row.key !== key).map(row => row.option)
          : [...selected, choice]
      );
    } else {
      props.onChange?.(choice);
    }
    if (blurInputOnSelect) {
      const input = inputRef.current;
      if (fromKeyboard) {
        input?.blur();
      } else {
        // React Aria keeps focus on the input until the pointer press finishes.
        blurFrame.current = requestAnimationFrame(() => {
          blurFrame.current = null;
          input?.blur();
        });
      }
    }
  }

  function clear() {
    if (props.multiple) {
      props.onChange?.([]);
    } else if (props.clearable) {
      props.onChange?.(null);
    }
    setFocusedChip(null);
    inputRef.current?.focus();
  }

  function remove(index: number) {
    if (!props.multiple) {
      return;
    }
    props.onChange?.(selected.filter((_, itemIndex) => itemIndex !== index));
    setFocusedChip(null);
    inputRef.current?.focus();
  }

  const matches = (row: OptionRow<TOption>) =>
    props.filterOption === null ||
    (props.filterOption ?? defaultFilter)(row.option, query);

  const collection = entries
    .map((entry, index) => {
      if (!('rows' in entry)) {
        return matches(entry) ? (
          <Item key={entry.key} textValue={optionText(entry.option)}>
            {entry.option.label}
          </Item>
        ) : null;
      }
      const children = entry.rows.filter(matches).map(({key, option}) => (
        <Item key={key} textValue={optionText(option)}>
          {option.label}
        </Item>
      ));
      return children.length > 0 ? (
        <Section key={`section:${index}`} title={entry.label}>
          {children}
        </Section>
      ) : null;
    })
    .filter(child => child !== null);
  if (canCreate) {
    collection.push(
      <Item key={CREATE_KEY} textValue={query}>
        {props.formatCreateLabel?.(query) ?? t('Create "%s"', query)}
      </Item>
    );
  }

  const state = useListState({
    children: collection,
    disabledKeys,
    selectedKeys,
    selectionMode: multiple ? 'multiple' : 'single',
    selectionBehavior: 'toggle',
    disallowEmptySelection: !multiple,
    allowDuplicateSelectionEvents: true,
    onSelectionChange: keys => {
      if (keys === 'all') {
        return;
      }
      const added = [...keys].find(key => !selectedKeys.includes(String(key)));
      const removed = selectedKeys.find(key => !keys.has(key));
      const key = added ?? removed ?? keys.values().next().value;
      if (key !== undefined) {
        choose(key, {deselect: added === undefined && removed !== undefined});
      }
    },
  });
  const {selectionManager} = state;
  const listId = useId();
  const inputId = useId();
  const valueId = useId();
  const {listBoxProps} = useListBox(
    {
      id: listId,
      'aria-label': t('Options'),
      shouldUseVirtualFocus: true,
      shouldFocusOnHover: true,
      shouldSelectOnPressUp: true,
      isVirtualized: virtualized,
    },
    state,
    listRef
  );
  const selectStyles = getSelectStyles(theme, size, {
    disabled,
    focused,
    hasChips: multiple && selected.length > 0,
    hasQuery: query !== '',
    searchable,
  });
  const {maxMenuWidth} = props;
  const baseMenuStyle: CSSObject = {
    ...selectStyles.menu,
    maxWidth: maxMenuWidth === '100%' ? (overlayStyle?.minWidth ?? '100%') : maxMenuWidth,
  };
  const menuStyle = applyStyleSlot(styles, 'menu', baseMenuStyle, {});
  const shouldLockMenuWidth = isOpen && virtualized && menuStyle.width === 'max-content';
  const widestKey = shouldLockMenuWidth
    ? getWidestMenuItemKey(
        flattenSections(state.collection).filter(node => node.type === 'item')
      )
    : undefined;
  const virtual = useVirtualCollection({
    collection: state.collection,
    enabled: virtualized,
    scrollRef: listRef,
    focusedKey: isOpen ? selectionManager.focusedKey : null,
    listPadding: 4,
    size,
    widestKey,
  });
  useVirtualMenuWidth({
    enabled: shouldLockMenuWidth,
    isWidthCandidateMounted: virtual.rows.some(row => row.node.key === widestKey),
    isWidthLocked: lockedMenuWidth !== undefined,
    menuRef,
    onLockWidth: setLockedMenuWidth,
  });
  const delegate = useMemo(
    () =>
      new ListKeyboardDelegate({
        collection: state.collection,
        disabledKeys: state.disabledKeys,
        ref: listRef,
        layoutDelegate: virtual.layoutDelegate,
      }),
    [state.collection, state.disabledKeys, virtual.layoutDelegate]
  );
  const {collectionProps} = useSelectableCollection({
    selectionManager,
    keyboardDelegate: delegate,
    ref: inputRef,
    shouldFocusWrap: true,
    shouldUseVirtualFocus: true,
    disallowTypeAhead: true,
    disallowSelectAll: true,
    disallowEmptySelection: true,
    isVirtualized: virtualized,
  });

  useImperativeHandle(
    selectHandleRef,
    () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
    }),
    [inputRef]
  );

  const focusedKey = selectionManager.focusedKey;
  const firstSelectedKey = selectionManager.firstSelectedKey;
  const selectedOptionKey =
    !multiple &&
    firstSelectedKey != null &&
    state.collection.getItem(firstSelectedKey) &&
    !selectionManager.isDisabled(firstSelectedKey)
      ? firstSelectedKey
      : null;
  useEffect(() => {
    if (!isOpen) {
      if (focusedKey != null) {
        selectionManager.setFocusedKey(null);
      }
      return;
    }
    if (focusedKey == null && state.collection.size > 0) {
      selectionManager.setFocusedKey(
        (query ? null : selectedOptionKey) ?? delegate.getFirstKey()
      );
    }
  }, [
    delegate,
    isOpen,
    focusedKey,
    query,
    selectedOptionKey,
    selectionManager,
    state.collection,
  ]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) {
      return;
    }

    if (!handleMenuKey(event)) {
      handleValueKey(event);
    }
  }

  function handleMenuKey(event: React.KeyboardEvent<HTMLInputElement>): boolean {
    // Inline footers follow the control in the DOM. Portaled footers need a focus handoff.
    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      isOpen &&
      menuPortalTarget &&
      footerRef.current
    ) {
      const next = getFocusableTreeWalker(footerRef.current, {tabbable: true}).nextNode();
      if (next instanceof HTMLElement) {
        event.preventDefault();
        next.focus();
      }
      return true;
    }
    const isSpaceAction = event.key === ' ' && (!searchable || !query);
    if (isSpaceAction && !isOpen) {
      event.preventDefault();
      overlayState.open();
      return true;
    }
    if (isOpen && (event.key === 'Enter' || isSpaceAction)) {
      event.preventDefault();
      const key = focusedKey ?? delegate.getFirstKey();
      if (key != null) {
        choose(key, {
          deselect: multiple && selectionManager.isSelected(key),
          fromKeyboard: true,
        });
      }
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen || focusedKey == null) {
        const edgeKey =
          event.key === 'ArrowDown' ? delegate.getFirstKey() : delegate.getLastKey();
        selectionManager.setFocusedKey(isOpen ? edgeKey : (selectedOptionKey ?? edgeKey));
        overlayState.open();
      } else {
        collectionProps.onKeyDown?.(event);
      }
      return true;
    }
    if (
      isOpen &&
      focusedKey != null &&
      ['PageUp', 'PageDown', 'Home', 'End'].includes(event.key)
    ) {
      collectionProps.onKeyDown?.(event);
      return true;
    }
    return false;
  }

  function handleValueKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (query || !selected.length) {
      return;
    }
    if (multiple && event.key === 'ArrowLeft') {
      setFocusedChip(Math.max(0, (focusedChip ?? selected.length) - 1));
    } else if (multiple && event.key === 'ArrowRight') {
      setFocusedChip(
        focusedChip != null && focusedChip < selected.length - 1 ? focusedChip + 1 : null
      );
    } else if (
      focusedChip != null &&
      (event.key === 'Backspace' || event.key === 'Delete')
    ) {
      remove(focusedChip);
    } else if (event.key === 'Backspace' && clearable) {
      event.preventDefault();
      if (multiple) {
        remove(selected.length - 1);
      } else {
        clear();
      }
    }
  }

  const inputEvents = {
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      updateQuery(event.currentTarget.value, 'input');
      selectionManager.setFocusedKey(null);
      setFocusedChip(null);
      overlayState.open();
    },
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => {
      cancelSelectionBlur();
      setFocused(true);
      selectionManager.setFocused(true);
      props.onFocus?.(event);
      if (openMenuOnFocus) {
        overlayState.open();
      }
    },
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      selectionManager.setFocused(false);
      setFocusedChip(null);
      if (overlayRef.current?.contains(event.relatedTarget)) {
        return;
      }
      props.onBlur?.(event);
      if (isOpen) {
        overlayState.close();
      } else {
        updateQuery('', 'reset');
      }
    },
  };
  const optionStyle = (option: SelectValue<TValue | string>) => ({
    data: option,
    isDisabled: Boolean(disabled || option.disabled),
    isSelected: true,
  });
  const {Value, MultiValueLabel, OptionLabel} = components ?? {};
  const showClearButton = clearable && selected.length > 0 && !disabled;
  const first = selected[0];
  const activeChip = focusedChip === null ? undefined : selected[focusedChip];

  return (
    <div
      className={props.className}
      ref={selectRef}
      data-scraps-select=""
      onKeyDown={event => {
        if (
          event.key !== 'Escape' ||
          !isOpen ||
          event.defaultPrevented ||
          event.nativeEvent.isComposing
        ) {
          return;
        }

        const input = inputRef.current;
        const fromMenu =
          event.target instanceof Node && overlayRef.current?.contains(event.target);
        if (event.target !== input && !fromMenu) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (fromMenu) {
          input?.focus();
        }
        overlayState.close();
      }}
      css={applyStyleSlot(styles, 'container', selectStyles.container, {
        isDisabled: disabled,
      })}
    >
      <div
        ref={mergeRefs<HTMLDivElement>(controlRef, element => setTriggerElement(element))}
        css={applyStyleSlot(styles, 'control', selectStyles.control, {
          isDisabled: disabled,
        })}
        onMouseDown={event => {
          if (
            event.target !== inputRef.current &&
            !(event.target instanceof Element && event.target.closest('button'))
          ) {
            event.preventDefault();
          }
        }}
        onClick={event => {
          if (
            disabled ||
            (event.target instanceof Element && event.target.closest('button'))
          ) {
            return;
          }
          event.preventDefault();
          inputRef.current?.focus();
          if (
            openMenuOnClick &&
            (!isOpen || event.target !== inputRef.current || !searchable)
          ) {
            overlayState.toggle();
          }
        }}
      >
        {isRenderable(leadingItems) && (
          <Flex align="center" flexShrink={0} gap="xs" css={selectStyles.leadingItems}>
            {leadingItems}
          </Flex>
        )}
        <div css={selectStyles.values}>
          {multiple && (
            <SelectChips
              disabled={disabled}
              focusedChip={focusedChip}
              MultiValueLabel={MultiValueLabel}
              onRemove={remove}
              selectedRows={selectedRows}
              selectStyles={selectStyles}
              styles={styles}
            />
          )}
          {!query && !multiple && first && (
            <div
              css={applyStyleSlot(
                styles,
                'singleValue',
                selectStyles.singleValue,
                optionStyle(first)
              )}
            >
              {Value ? (
                <Value option={first} />
              ) : (
                <Fragment>
                  {typeof first.leadingItems === 'function'
                    ? first.leadingItems({
                        disabled: Boolean(disabled),
                        isSelected: true,
                        isFocused: false,
                      })
                    : first.leadingItems}
                  <span css={selectStyles.valueLabel}>{first.label}</span>
                </Fragment>
              )}
            </div>
          )}
          {!query && !selected.length && (
            <div
              css={applyStyleSlot(styles, 'placeholder', selectStyles.placeholder, {})}
            >
              {placeholder === undefined ? t('Select...') : placeholder}
            </div>
          )}
          {selected.length > 0 && (
            <VisuallyHidden id={valueId}>
              {t('Selected: %s', selected.map(optionText).join(', '))}
            </VisuallyHidden>
          )}
          <input
            {...inputEvents}
            id={props.id ?? inputId}
            aria-label={
              props['aria-label'] ??
              (props.id || props['aria-labelledby'] ? undefined : t('Select options'))
            }
            aria-labelledby={props['aria-labelledby']}
            aria-describedby={
              [props['aria-describedby'], selected.length ? valueId : undefined]
                .filter(Boolean)
                .join(' ') || undefined
            }
            value={query}
            autoComplete="off"
            autoFocus={props.autoFocus}
            readOnly={!searchable}
            disabled={disabled}
            ref={inputRef}
            role="combobox"
            onKeyDown={onKeyDown}
            onPointerDown={cancelSelectionBlur}
            aria-invalid={props['aria-invalid']}
            aria-autocomplete={searchable ? 'list' : 'none'}
            aria-expanded={isOpen}
            aria-controls={isOpen ? listId : undefined}
            aria-activedescendant={
              isOpen &&
              focusedKey != null &&
              virtual.rows.some(row => row.node.key === focusedKey)
                ? getItemId(state, focusedKey)
                : undefined
            }
            tabIndex={props.tabIndex}
            css={applyStyleSlot(styles, 'input', selectStyles.input, {})}
          />
        </div>
        <SelectIndicators
          dropdownIndicator={dropdownIndicator}
          isLoading={isLoading}
          onClear={clear}
          selectStyles={selectStyles}
          showClearButton={showClearButton}
          trailingItems={trailingItems}
        />
      </div>
      {multiple && (
        <VisuallyHidden role="status" aria-atomic="true">
          {!query && focusedChip !== null && activeChip
            ? t(
                '%s, %s of %s. Press Backspace to remove.',
                optionText(activeChip),
                focusedChip + 1,
                selected.length
              )
            : null}
        </VisuallyHidden>
      )}
      {name &&
        !disabled &&
        (selected.length ? selected : [null]).map((option, index) => (
          <input
            key={index}
            type="hidden"
            name={name}
            value={String(option?.value ?? '')}
          />
        ))}
      {isOpen && (
        <SelectMenu
          controlRef={controlRef}
          footerRef={footerRef}
          isInsideModal={props.isInsideModal}
          isLoading={isLoading}
          listBoxProps={listBoxProps}
          listRef={listRef}
          loadingMessage={props.loadingMessage}
          lockedMenuWidth={shouldLockMenuWidth ? lockedMenuWidth : undefined}
          maxMenuHeight={maxMenuHeight}
          menuFooter={props.menuFooter}
          menuPortalTarget={menuPortalTarget}
          menuRef={menuRef}
          menuStyle={menuStyle}
          minMenuHeight={minMenuHeight}
          multiple={multiple}
          noOptionsMessage={props.noOptionsMessage}
          onClose={overlayState.close}
          OptionLabel={OptionLabel}
          overlayStyle={overlayStyle}
          query={query}
          rowsByKey={rowsByKey}
          selectStyles={selectStyles}
          setOverlayElement={setOverlayElement}
          showCreateOptionIcon={props.showCreateOptionIcon}
          showDividers={props.showDividers}
          size={size}
          state={state}
          styles={styles}
          virtual={virtual}
          virtualized={virtualized}
        />
      )}
    </div>
  );
}
