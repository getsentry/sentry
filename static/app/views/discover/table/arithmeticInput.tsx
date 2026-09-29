import {Fragment, useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import type {InputProps} from '@sentry/scraps/input';
import {Input} from '@sentry/scraps/input';

import {t} from 'sentry/locale';
import type {Column} from 'sentry/utils/discover/fields';
import {
  generateEquationFieldAsString,
  isLegalEquationColumn,
} from 'sentry/utils/discover/fields';

const NONE_SELECTED = -1;

type DropdownOption = {
  active: boolean;
  kind: 'field' | 'operator';
  value: string;
};

type DropdownOptionGroup = {
  options: DropdownOption[];
  title: string;
};

type Props = InputProps & {
  onUpdate: (value: string) => void;
  value: string;
  className?: string;
  hideFieldOptions?: boolean;
  options?: Column[];
};

export function ArithmeticInput({
  options = [],
  onUpdate,
  value,
  className,
  hideFieldOptions,
  ...inputProps
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFocusRef = useRef<number | null>(null);

  const [query, setQuery] = useState(value);
  const [partialTerm, setPartialTerm] = useState<string | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [activeSelection, setActiveSelection] = useState(NONE_SELECTED);

  // Derived-state pattern: reset activeSelection when options change (deep equality),
  // mirroring getDerivedStateFromProps. Setting state during render is React's
  // recommended approach for this pattern and avoids a useEffect.
  const [prevOptions, setPrevOptions] = useState(options);
  if (!isEqual(prevOptions, options)) {
    setPrevOptions(options);
    setActiveSelection(NONE_SELECTED);
  }

  // Apply pending focus position after query state update
  useLayoutEffect(() => {
    if (pendingFocusRef.current !== null) {
      const position = pendingFocusRef.current;
      pendingFocusRef.current = null;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(position, position);
    }
  }, [query]);

  const dropdownOptionGroups = useMemo(() => {
    const groups = makeOptions(options, partialTerm, hideFieldOptions);
    if (activeSelection >= 0) {
      const flattenedOptions = groups.flatMap(group => group.options);
      if (flattenedOptions[activeSelection]) {
        flattenedOptions[activeSelection]!.active = true;
      }
    }
    return groups;
  }, [options, partialTerm, hideFieldOptions, activeSelection]);

  function blur() {
    inputRef.current?.blur();
  }

  function getCursorPosition(): number {
    return inputRef.current?.selectionStart ?? -1;
  }

  function splitQuery(currentQuery: string, cursorPosition?: number) {
    const currentPosition = cursorPosition ?? getCursorPosition();

    // The current term is delimited by whitespaces. So if no spaces are found,
    // the entire string is taken to be 1 term.
    //
    // TODO: add support for when there are no spaces

    const matches = [...currentQuery.substring(0, currentPosition).matchAll(/\s|^/g)];
    const match = matches[matches.length - 1]!;
    const startOfTerm = match[0] === '' ? 0 : (match.index || 0) + 1;

    const cursorOffset = currentQuery.slice(currentPosition).search(/\s|$/);
    const endOfTerm = currentPosition + (cursorOffset === -1 ? 0 : cursorOffset);

    return {
      startOfTerm,
      endOfTerm,
      prefix: currentQuery.substring(0, startOfTerm),
      term: currentQuery.substring(startOfTerm, endOfTerm),
      suffix: currentQuery.substring(endOfTerm),
    };
  }

  function updateAutocompleteOptions(currentQuery: string, cursorPosition?: number) {
    const {term} = splitQuery(currentQuery, cursorPosition);
    const newPartialTerm = term || null;
    setPartialTerm(newPartialTerm);
  }

  function getSelection(selection: number): DropdownOption | null {
    for (const group of dropdownOptionGroups) {
      if (selection >= group.options.length) {
        selection -= group.options.length;
        continue;
      }
      return group.options[selection]!;
    }
    return null;
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newQuery = event.target.value.replace('\n', '');
    setQuery(newQuery);
    updateAutocompleteOptions(newQuery);
  }

  function handleClick() {
    updateAutocompleteOptions(query);
  }

  function handleFocus() {
    setDropdownVisible(true);
  }

  function handleBlur() {
    onUpdate(query);
    setDropdownVisible(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const {key} = event;
    const startedSelection = activeSelection >= 0;

    // handle arrow navigation
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();

      const flattenedOptions = dropdownOptionGroups.flatMap(group => group.options);
      if (flattenedOptions.length === 0) {
        return;
      }

      let newSelection: number;
      if (startedSelection) {
        newSelection =
          key === 'ArrowUp'
            ? (activeSelection - 1 + flattenedOptions.length) % flattenedOptions.length
            : (activeSelection + 1) % flattenedOptions.length;
      } else {
        newSelection = key === 'ArrowUp' ? flattenedOptions.length - 1 : 0;
      }

      setActiveSelection(newSelection);
      return;
    }

    // handle selection
    if (startedSelection && (key === 'Tab' || key === 'Enter')) {
      event.preventDefault();

      const selection = getSelection(activeSelection);
      if (selection) {
        handleSelect(selection);
      }
      return;
    }

    if (key === 'Enter') {
      blur();
      return;
    }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      updateAutocompleteOptions(query);
    }
  }

  function handleKeyUp(event: React.KeyboardEvent<HTMLInputElement>) {
    // Other keys are managed at handleKeyDown function
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();

    const startedSelection = activeSelection >= 0;

    if (!startedSelection) {
      blur();
      return;
    }
  }

  function handleSelect(option: DropdownOption) {
    const {prefix, suffix} = splitQuery(query);
    const newQuery = `${prefix}${option.value} ${suffix}`;
    // The cursor will land after the autocompleted term + the inserted space
    const focusPosition = prefix.length + option.value.length + 1;

    // Schedule cursor move to run after the DOM commits
    pendingFocusRef.current = focusPosition;

    setQuery(newQuery);
    setActiveSelection(NONE_SELECTED);
    // Compute partialTerm using the known future cursor position so we don't
    // rely on the stale DOM cursor (the cursor hasn't moved yet at this point)
    updateAutocompleteOptions(newQuery, focusPosition);
  }

  return (
    <Container isOpen={dropdownVisible} className={className}>
      <Input
        {...inputProps}
        ref={inputRef}
        autoComplete="off"
        className="form-control"
        value={query}
        onClick={handleClick}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        spellCheck={false}
      />
      <TermDropdown
        isOpen={dropdownVisible}
        optionGroups={dropdownOptionGroups}
        handleSelect={handleSelect}
      />
    </Container>
  );
}

const Container = styled('div')<{isOpen: boolean}>`
  background: ${p => p.theme.tokens.background.primary};
  position: relative;

  border-radius: ${p =>
    p.isOpen ? `${p.theme.radius.md} ${p.theme.radius.md} 0 0` : p.theme.radius.md};

  .show-sidebar & {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

type TermDropdownProps = {
  handleSelect: (option: DropdownOption) => void;
  isOpen: boolean;
  optionGroups: DropdownOptionGroup[];
};

function TermDropdown({isOpen, optionGroups, handleSelect}: TermDropdownProps) {
  return (
    <DropdownContainer isOpen={isOpen}>
      {isOpen && (
        <DropdownItemsList>
          {optionGroups.map(group => {
            const {title, options} = group;
            return (
              <Fragment key={title}>
                <ListItem>
                  <DropdownTitle aria-label={title}>{title}</DropdownTitle>
                </ListItem>
                {options.map(option => {
                  return (
                    <DropdownListItem
                      key={option.value}
                      className={option.active ? 'active' : undefined}
                      onClick={() => handleSelect(option)}
                      // prevent the blur event on the input from firing
                      onMouseDown={event => event.preventDefault()}
                      // scroll into view if it is the active element
                      ref={element => {
                        if (option.active) {
                          element?.scrollIntoView?.({block: 'nearest'});
                        }
                      }}
                      aria-label={option.value}
                    >
                      <DropdownItemTitleWrapper>{option.value}</DropdownItemTitleWrapper>
                    </DropdownListItem>
                  );
                })}
                {options.length === 0 && <Info>{t('No items found')}</Info>}
              </Fragment>
            );
          })}
        </DropdownItemsList>
      )}
    </DropdownContainer>
  );
}

function makeFieldOptions(
  columns: Column[],
  partialTerm: string | null
): DropdownOptionGroup {
  const fieldValues = new Set<string>();
  const options = columns
    .filter(({kind}) => kind !== 'equation')
    .filter(isLegalEquationColumn)
    .map(option => ({
      kind: 'field' as const,
      active: false,
      value: generateEquationFieldAsString(option),
    }))
    .filter(({value}) => {
      if (fieldValues.has(value)) {
        return false;
      }
      fieldValues.add(value);
      return true;
    })
    .filter(({value}) => (partialTerm ? value.includes(partialTerm) : true));

  return {
    title: 'Fields',
    options,
  };
}

function makeOperatorOptions(partialTerm: string | null): DropdownOptionGroup {
  const options = ['+', '-', '*', '/', '(', ')']
    .filter(operator => (partialTerm ? operator.includes(partialTerm) : true))
    .map(operator => ({
      kind: 'operator' as const,
      active: false,
      value: operator,
    }));

  return {
    title: 'Operators',
    options,
  };
}

function makeOptions(
  columns: Column[],
  partialTerm: string | null,
  hideFieldOptions?: boolean
): DropdownOptionGroup[] {
  if (hideFieldOptions) {
    return [makeOperatorOptions(partialTerm)];
  }

  return [makeFieldOptions(columns, partialTerm), makeOperatorOptions(partialTerm)];
}

const DropdownContainer = styled('div')<{isOpen: boolean}>`
  /* Container has a border that we need to account for */
  display: ${p => (p.isOpen ? 'block' : 'none')};
  position: absolute;
  top: 100%;
  left: -1px;
  right: -1px;
  z-index: ${p => p.theme.zIndex.dropdown};
  background: ${p => p.theme.tokens.background.primary};
  box-shadow: ${p => p.theme.shadow.high};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  margin-top: ${p => p.theme.space.md};
  max-height: 300px;
  overflow-y: auto;
`;

const DropdownItemsList = styled('ul')`
  padding-left: 0;
  list-style: none;
  margin-bottom: 0;
`;

const ListItem = styled('li')`
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const DropdownTitle = styled('header')`
  display: flex;
  align-items: center;

  background-color: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-size: ${p => p.theme.font.size.md};

  margin: 0;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};

  & > svg {
    margin-right: ${p => p.theme.space.md};
  }
`;

const DropdownListItem = styled(ListItem)`
  scroll-margin: 40px 0;
  font-size: ${p => p.theme.font.size.lg};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
  &.active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const DropdownItemTitleWrapper = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-size: ${p => p.theme.font.size.md};
  margin: 0;
  line-height: ${p => p.theme.font.lineHeight.default};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Info = styled('div')`
  display: flex;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-size: ${p => p.theme.font.size.lg};
  color: ${p => p.theme.tokens.content.secondary};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;
