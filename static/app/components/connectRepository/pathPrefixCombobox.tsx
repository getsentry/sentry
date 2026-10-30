import {useMemo, useRef, useState} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';

import {Select} from '@sentry/scraps/select';
import type {SelectValue} from '@sentry/scraps/select';

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
  id?: string;
  isLoading?: boolean;
  maxMenuHeight?: number;
  menuAlign?: 'start' | 'end';
  menuWidth?: string;
  name?: string;
  onBlur?: () => void;
  placeholder?: string;
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
  disabled,
  id,
  isLoading,
  maxMenuHeight,
  menuAlign = 'start',
  menuWidth,
  name,
  onBlur,
  placeholder,
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
  // Tracks whether the user explicitly picked the catch-all option, so we can
  // show its label rather than the placeholder for an unset (empty string) value.
  const [catchAllPicked, setCatchAllPicked] = useState(false);

  const mappedOptions = useMemo(() => rawOptions.map(toPrefixSelectValue), [rawOptions]);

  const visibleOptions = useMemo<Array<SelectValue<string>>>(() => {
    const filtered = filterPrefixOptions(mappedOptions, debouncedInput);
    // Hidden while typing so Enter creates the typed prefix instead of matching all.
    return inputValue ? filtered : [CATCH_ALL_OPTION, ...filtered];
  }, [mappedOptions, debouncedInput, inputValue]);

  function handleBlur() {
    if (typedTextRef.current) {
      setCatchAllPicked(false);
      onChange(normalizeRoot(typedTextRef.current));
    }
    setTypedText('');
    onBlur?.();
  }

  function handleChange(option: SelectValue<string> | null) {
    if (!option) {
      return;
    }
    setCatchAllPicked(option.value === CATCH_ALL_VALUE);
    onChange(normalizeRoot(option.value));
  }

  // Show the placeholder for an empty value until the user explicitly picks the
  // catch-all option; passing null defers to the placeholder prop instead.
  const selectValue = value === CATCH_ALL_VALUE && !catchAllPicked ? null : value;

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
      disabled={disabled}
      isLoading={isLoading}
      placeholder={placeholder ?? t('e.g. src/')}
      options={visibleOptions}
      value={selectValue}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={setTypedText}
      onBlur={handleBlur}
      // Options are filtered on the debounced input above.
      filterOption={null}
      formatCreateLabel={(input: string) => tct('Use "[path]"', {path: input})}
      virtualized
      maxMenuHeight={maxMenuHeight}
      styles={prefixMenuStyles(menuWidth, menuAlign)}
    />
  );
}
