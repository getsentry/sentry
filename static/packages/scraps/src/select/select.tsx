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
import {createPortal} from 'react-dom';
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
import {IconChevron} from '@sentry/icons/chevron';
import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {PanelProvider} from '@sentry/scraps/panelProvider';
import {Spinner} from '@sentry/scraps/spinner';
import type {FormSize} from '@sentry/scraps/theme';
import {useTranslation} from '@sentry/scraps/translation';
import {useOverlay} from '@sentry/scraps/useOverlay';
import {useVirtualCollection, VirtualRows} from '@sentry/scraps/useVirtualCollection';

import {createFilter} from './filter';
import {SelectOption, SelectSection} from './option';
import {useOptionIndex, type OptionRow} from './options';
import {getSelectStyles} from './styles';
import type {
  SelectComponents,
  SelectHandle,
  SelectSelectionProps,
  SelectValue,
  StylesConfig,
} from './types';

export interface BaseSelectProps<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
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
  components?: SelectComponents<TOption>;
  /** Content inside the control, before the selected value and input. */
  controlLeadingItems?: React.ReactNode;
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
  loadingMessage?: () => React.ReactNode;
  maxMenuHeight?: number;
  maxMenuWidth?: number | string;
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
  styles?: StylesConfig<NoInfer<TValue>, NoInfer<TOption>>;
  tabIndex?: number;
  /** Virtualize large lists, including lists with sections. */
  virtualized?: boolean;
}

type DisabledSelectionProps<Props extends {onChange: unknown}> = Props extends unknown
  ? Omit<Props, 'onChange'> & {disabled: true; onChange?: Props['onChange']}
  : never;

export type ControlProps<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
> = (
  | SelectSelectionProps<TValue, TOption>
  | DisabledSelectionProps<SelectSelectionProps<TValue, TOption>>
) &
  BaseSelectProps<TValue, TOption>;

const CREATE_KEY = 'create';
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
) {
  const {
    options,
    ref: selectHandleRef,
    inputRef: providedInputRef,
    isLoading,
    dropdownIndicator,
    placeholder,
    isValueEqual,
    multiple = false,
    clearable,
    disabled,
    creatable,
    searchable = true,
    styles,
    size = 'md',
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
  const listRef = useRef<HTMLUListElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [localQuery, setLocalQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [focusedChip, setFocusedChip] = useState<number | null>(null);
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
    position: 'bottom-start',
    offset: 4,
    strategy: menuPortalTarget ? 'fixed' : 'absolute',
    type: 'listbox',
    isKeyboardDismissDisabled: true,
    isDismissable: false,
  });
  useInteractOutside({
    ref: selectRef,
    isDisabled: !isOpen,
    onInteractOutside: event => {
      if (event.target instanceof Node && !overlayRef.current?.contains(event.target)) {
        overlayState.close();
      }
    },
  });

  const {entries, rows} = useOptionIndex(options, isValueEqual);
  const rowsByKey = new Map<Key, TOption>(rows.map(row => [row.key, row.option]));
  const rawValues: Array<TValue | null> = props.multiple ? props.value : [props.value];
  const selectedRows = rawValues.flatMap<{option: TOption; key?: string}>(value => {
    const existing = rows.find(row =>
      value != null && row.option.value != null && isValueEqual
        ? isValueEqual(row.option.value, value)
        : row.option.value === value
    );
    if (existing) {
      return [existing];
    }
    if (creatable && value != null) {
      return [{option: {value, label: String(value)} as TOption, key: undefined}];
    }
    return [];
  });
  const selectedKeys = selectedRows.flatMap(({key}) => (key === undefined ? [] : [key]));
  const selected = selectedRows.map(({option}) => option);
  const disabledKeys = rows.flatMap(({key, option}) => (option.disabled ? [key] : []));
  const canCreate =
    creatable &&
    query !== '' &&
    !isLoading &&
    ![...rows.map(row => row.option), ...selected].some(option =>
      [option.label, option.value].some(
        value => typeof value === 'string' && value.toLowerCase() === query.toLowerCase()
      )
    );

  function commit(next: TOption[] | TOption | null, action: string) {
    // The previous implementation also supplied action metadata at runtime.
    const onChange = props.onChange as
      | ((value: typeof next, metadata: {action: string; name?: string}) => void)
      | undefined;
    onChange?.(next, {action, name});
  }

  function choose(key: Key, deselect = false, fromKeyboard = false) {
    const option = rowsByKey.get(key);
    if (key !== CREATE_KEY && (!option || option.disabled)) {
      return;
    }
    const created = key === CREATE_KEY;
    const choice =
      option ?? ({value: query, label: query, __isNew__: true} as unknown as TOption);
    setFocusedChip(null);
    if (!multiple && isOpen) {
      overlayState.close();
    } else {
      updateQuery('', 'reset');
    }
    if (created && props.onCreateOption) {
      props.onCreateOption(query);
    } else if (multiple) {
      commit(
        deselect
          ? selectedRows.filter(row => row.key !== key).map(row => row.option)
          : [...selected, choice],
        created ? 'create-option' : deselect ? 'deselect-option' : 'select-option'
      );
    } else {
      commit(choice, created ? 'create-option' : 'select-option');
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
    commit(multiple ? [] : null, 'clear');
    setFocusedChip(null);
    inputRef.current?.focus();
  }

  function remove(index: number, action = 'remove-value') {
    commit(
      selected.filter((_, itemIndex) => itemIndex !== index),
      action
    );
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
        choose(key, added === undefined && removed !== undefined);
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
  const virtual = useVirtualCollection({
    collection: state.collection,
    enabled: virtualized,
    scrollRef: listRef,
    focusedKey: isOpen ? selectionManager.focusedKey : null,
    listPadding: 4,
    size,
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
  useEffect(() => {
    if (!isOpen) {
      if (focusedKey != null) {
        selectionManager.setFocusedKey(null);
      }
      return;
    }
    if (focusedKey == null && state.collection.size > 0) {
      const firstSelectedKey = selectionManager.firstSelectedKey;
      selectionManager.setFocusedKey(
        !multiple &&
          firstSelectedKey != null &&
          state.collection.getItem(firstSelectedKey) &&
          !selectionManager.isDisabled(firstSelectedKey)
          ? firstSelectedKey
          : delegate.getFirstKey()
      );
    }
  }, [delegate, isOpen, focusedKey, multiple, selectionManager, state.collection]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) {
      return;
    }

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
      return;
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      overlayState.close();
      return;
    }
    if (event.key === ' ' && !searchable && !isOpen) {
      event.preventDefault();
      overlayState.open();
      return;
    }
    if (isOpen && (event.key === 'Enter' || (!searchable && event.key === ' '))) {
      event.preventDefault();
      const key = focusedKey ?? delegate.getFirstKey();
      if (key != null) {
        choose(key, multiple && selectionManager.isSelected(key), true);
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen || focusedKey == null) {
        selectionManager.setFocusedKey(
          event.key === 'ArrowDown' ? delegate.getFirstKey() : delegate.getLastKey()
        );
        overlayState.open();
        return;
      }
      collectionProps.onKeyDown?.(event);
      return;
    }
    if (
      isOpen &&
      focusedKey != null &&
      ['PageUp', 'PageDown', 'Home', 'End'].includes(event.key)
    ) {
      collectionProps.onKeyDown?.(event);
      return;
    }
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
      remove(focusedChip, 'pop-value');
    } else if (event.key === 'Backspace' && clearable) {
      if (multiple) {
        remove(selected.length - 1, 'pop-value');
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
  const css = getSelectStyles(theme, size, {disabled, focused, multiple, searchable});
  const optionStyle = (option: TOption) => ({
    data: option,
    isDisabled: Boolean(disabled || option.disabled),
    isSelected: selected.includes(option),
  });
  const {Value, MultiValueLabel, Indicators, OptionLabel} = components ?? {};
  const indicatorContent = (
    <Fragment>
      {clearable && selected.length > 0 && !disabled && (
        <Button
          size="zero"
          variant="transparent"
          aria-label={t('Clear choices')}
          icon={<IconClose size="xs" />}
          tabIndex={-1}
          onMouseDown={event => event.preventDefault()}
          onClick={clear}
        />
      )}
      {isLoading && <Spinner mini size={14} />}
      {dropdownIndicator !== null && (
        <Flex as="span" align="center" aria-hidden="true">
          {dropdownIndicator ?? <IconChevron direction="down" size="xs" />}
        </Flex>
      )}
    </Fragment>
  );
  const baseMenuStyle: CSSObject = {...css.menu, maxWidth: props.maxMenuWidth};
  const menuStyle = styles?.menu?.(baseMenuStyle, {}) ?? baseMenuStyle;
  const positionStyle: CSSObject = {
    ...(menuStyle.position === 'initial' ? {} : overlayStyle),
    display: 'flex',
    flexDirection: 'column',
    zIndex: props.isInsideModal ? theme.zIndex.modal + 1 : theme.zIndex.dropdown,
  };
  const menuListStyle = {
    ...css.menuList,
    maxHeight: maxMenuHeight,
    minHeight: minMenuHeight ?? 0,
  };
  const menu = isOpen && (
    <div
      ref={setOverlayElement}
      data-overlay-root=""
      css={
        menuPortalTarget
          ? (styles?.menuPortal?.(positionStyle, {}) ?? positionStyle)
          : positionStyle
      }
      onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          inputRef.current?.focus();
          overlayState.close();
        }
      }}
      onBlur={event => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !controlRef.current?.contains(event.relatedTarget)
        ) {
          overlayState.close();
        }
      }}
    >
      <PanelProvider>
        <div css={menuStyle}>
          <ul
            {...listBoxProps}
            ref={listRef}
            css={styles?.menuList?.(menuListStyle, {}) ?? menuListStyle}
          >
            <VirtualRows
              virtual={virtual}
              renderRow={row => (
                <SelectOption
                  row={row}
                  state={state}
                  option={rowsByKey.get(row.node.key)}
                  size={size}
                  multiple={multiple}
                  virtualized={virtualized}
                  showDividers={props.showDividers}
                  showCreateOptionIcon={props.showCreateOptionIcon}
                  OptionLabel={OptionLabel}
                  styleOption={styles?.option}
                  create={row.node.key === CREATE_KEY}
                />
              )}
              renderSection={(section, children) => (
                <SelectSection
                  row={section}
                  headingStyle={styles?.groupHeading?.(css.heading, {}) ?? css.heading}
                >
                  {children}
                </SelectSection>
              )}
            />
          </ul>
          {state.collection.size === 0 && (
            <div role="status" css={css.message}>
              {isLoading
                ? props.loadingMessage
                  ? props.loadingMessage()
                  : t('Loading...')
                : props.noOptionsMessage
                  ? props.noOptionsMessage({inputValue: query})
                  : t('No options')}
            </div>
          )}
          {props.menuFooter && <div ref={footerRef}>{props.menuFooter}</div>}
        </div>
      </PanelProvider>
    </div>
  );
  const first = selected[0];

  return (
    <div
      className={props.className}
      ref={selectRef}
      data-scraps-select=""
      css={styles?.container?.(css.container, {isDisabled: disabled}) ?? css.container}
    >
      <div
        ref={mergeRefs<HTMLDivElement>(controlRef, element => setTriggerElement(element))}
        css={styles?.control?.(css.control, {isDisabled: disabled}) ?? css.control}
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
        {props.controlLeadingItems}
        <div css={css.values}>
          {multiple &&
            selectedRows.map(({option, key}, index) => (
              <div
                key={key ?? index}
                css={
                  styles?.multiValue?.(
                    {...css.chip, ...(index === focusedChip && theme.focusRing())},
                    optionStyle(option)
                  ) ?? {...css.chip, ...(index === focusedChip && theme.focusRing())}
                }
              >
                <span
                  css={
                    styles?.multiValueLabel?.(css.chipLabel, optionStyle(option)) ??
                    css.chipLabel
                  }
                >
                  {MultiValueLabel ? (
                    <MultiValueLabel option={option}>{option.label}</MultiValueLabel>
                  ) : (
                    option.label
                  )}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={t('Remove item')}
                    css={
                      styles?.multiValueRemove?.(css.chipRemove, optionStyle(option)) ??
                      css.chipRemove
                    }
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => remove(index)}
                  >
                    <IconClose size="xs" />
                  </button>
                )}
              </div>
            ))}
          {!query && !multiple && first && (
            <div
              css={
                styles?.singleValue?.(css.singleValue, optionStyle(first)) ??
                css.singleValue
              }
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
                  <span css={css.valueLabel}>{first.label}</span>
                </Fragment>
              )}
            </div>
          )}
          {!query && !selected.length && (
            <div css={styles?.placeholder?.(css.placeholder, {}) ?? css.placeholder}>
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
            css={styles?.input?.(css.input, {}) ?? css.input}
          />
        </div>
        {Indicators !== null && (
          <div css={css.indicators}>
            {Indicators ? <Indicators>{indicatorContent}</Indicators> : indicatorContent}
          </div>
        )}
      </div>
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
      {menuPortalTarget && menu ? createPortal(menu, menuPortalTarget) : menu}
    </div>
  );
}
