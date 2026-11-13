import {useMemo, useRef, useState, type ReactNode} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';

import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import type {SelectValue} from '@sentry/scraps/select';
import type {FormSize} from '@sentry/scraps/theme';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t, tct} from 'sentry/locale';

import {normalizeRoot} from './normalization';
import type {PathPrefixOption} from './type';

const CATCH_ALL_VALUE = '';
const CATCH_ALL_OPTION: SelectValue<string> = {
  value: CATCH_ALL_VALUE,
  label: t('No prefix (match all)'),
};

function prefixMenuStyles(menuWidth: string | undefined, menuAlign: 'start' | 'end') {
  if (!menuWidth) {
    return;
  }
  const anchor = menuAlign === 'end' ? {right: 0, left: 'auto'} : undefined;
  return {
    menu: <T extends Record<string, unknown>>(base: T) => ({
      ...base,
      width: menuWidth,
      ...anchor,
    }),
  };
}

function toPrefixSelectValue(opt: PathPrefixOption): SelectValue<string> {
  return {value: opt.path, label: opt.path, textValue: opt.path};
}

function filterPrefixOptions(
  options: Array<SelectValue<string>>,
  query: string
): Array<SelectValue<string>> {
  if (!query) {
    return options;
  }
  const lower = query.toLowerCase();
  return options.filter(o => o.value.toLowerCase().includes(lower));
}

export interface PathPrefixComboboxProps {
  onChange: (value: string) => void;
  options: PathPrefixOption[];
  value: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
  disabled?: boolean;
  /** Info tip shown in the field while it is set to "No prefix". */
  emptyHint?: ReactNode;
  id?: string;
  isLoading?: boolean;
  maxMenuHeight?: number;
  menuAlign?: 'start' | 'end';
  menuWidth?: string;
  name?: string;
  onBlur?: () => void;
  placeholder?: string;
  size?: FormSize;
}

/**
 * Creatable path prefix select. Emitted values are normalized, and typed
 * text is committed on blur.
 */
export function PathPrefixCombobox({
  onChange,
  options: rawOptions,
  value,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
  emptyHint,
  disabled,
  id,
  isLoading,
  maxMenuHeight,
  menuAlign = 'start',
  menuWidth,
  name,
  onBlur,
  placeholder,
  size,
}: PathPrefixComboboxProps) {
  const [inputValue, setInputValue] = useState('');
  // A ref that always holds the latest typed text synchronously. State updates
  // are batched, so input-blur (fired in the same tick as set-value on a pick)
  // would read stale state — the ref avoids that.
  const typedTextRef = useRef('');

  function setTypedText(text: string) {
    typedTextRef.current = text;
    setInputValue(text);
  }
  const [debouncedInput] = useDebouncedValue(inputValue, {
    wait: DEFAULT_DEBOUNCE_DURATION,
  });
  // Whether the user has typed since focusing the field. Opening the menu on
  // "No prefix" keeps that label; only clearing typed text shows the placeholder.
  const [hasTyped, setHasTyped] = useState(false);

  const mappedOptions = useMemo(() => rawOptions.map(toPrefixSelectValue), [rawOptions]);

  const visibleOptions = useMemo<Array<SelectValue<string>>>(() => {
    const filtered = filterPrefixOptions(mappedOptions, debouncedInput);
    // Hidden while typing so Enter creates the typed prefix instead of matching all.
    return inputValue ? filtered : [CATCH_ALL_OPTION, ...filtered];
  }, [mappedOptions, debouncedInput, inputValue]);

  function handleBlur() {
    if (typedTextRef.current) {
      onChange(normalizeRoot(typedTextRef.current));
    }
    setTypedText('');
    setHasTyped(false);
    onBlur?.();
  }

  function handleChange(option: SelectValue<string> | null) {
    if (!option) {
      return;
    }
    onChange(normalizeRoot(option.value));
  }

  // An empty value means "no prefix", so show that option. Once the user has
  // typed and cleared the text, show the placeholder instead (null defers to it)
  // so the empty field gives an example of what to enter.
  const selectValue = value === CATCH_ALL_VALUE && hasTyped ? null : value;
  const showEmptyHint = Boolean(emptyHint) && selectValue === CATCH_ALL_VALUE;

  return (
    <Select
      aria-label={ariaLabel ?? t('Path prefix')}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
      id={id}
      name={name}
      creatable
      searchable
      isInsideModal
      size={size}
      disabled={disabled}
      isLoading={isLoading}
      placeholder={placeholder ?? t('e.g. src/')}
      options={visibleOptions}
      value={selectValue}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={(text, reason) => {
        if (reason === 'input') {
          setHasTyped(true);
        }
        setTypedText(text);
      }}
      onBlur={handleBlur}
      // Leading slot, not the dropdown indicator: the select hides its
      // indicators from assistive tech, which would hide the tip too.
      controlLeadingItems={
        showEmptyHint ? (
          <Flex align="center" paddingLeft="lg" flexShrink={0}>
            <InfoTip title={emptyHint} size="xs" />
          </Flex>
        ) : undefined
      }
      // Options are filtered on the debounced input above.
      filterOption={null}
      formatCreateLabel={(input: string) => tct('Use "[path]"', {path: input})}
      virtualized
      maxMenuHeight={maxMenuHeight}
      styles={prefixMenuStyles(menuWidth, menuAlign)}
    />
  );
}
