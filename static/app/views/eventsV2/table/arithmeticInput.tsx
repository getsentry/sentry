import {createRef, Fragment, HTMLProps, PureComponent} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import Input from 'sentry/components/forms/controls/input';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {
  Column,
  generateFieldAsString,
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

type DefaultProps = {
  options: Column[];
};

type Props = DefaultProps &
  HTMLProps<HTMLInputElement> & {
    onUpdate: (value: string) => void;
    value: string;
  };

type State = {
  activeSelection: number;
  dropdownOptionGroups: DropdownOptionGroup[];
  dropdownVisible: boolean;
  partialTerm: string | null;
  query: string;
  rawOptions: Column[];
};

export default class ArithmeticInput extends PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    options: [],
  };

  static getDerivedStateFromProps(props: Readonly<Props>, state: State): State {
    const changed = !isEqual(state.rawOptions, props.options);

    if (changed) {
      return {
        ...state,
        rawOptions: props.options,
        dropdownOptionGroups: makeOptions(props.options, state.partialTerm),
        activeSelection: NONE_SELECTED,
      };
    }

    return {...state};
  }

  state: State = {
    query: this.props.value,
    partialTerm: null,
    rawOptions: this.props.options,
    dropdownVisible: false,
    dropdownOptionGroups: makeOptions(this.props.options, null),
    activeSelection: NONE_SELECTED,
  };

  input = createRef<HTMLInputElement>();

  blur = () => {
    this.input.current?.blur();
  };

  focus = (position: number) => {
    this.input.current?.focus();
    this.input.current?.setSelectionRange(position, position);
  };

  getCursorPosition(): number {
    return this.input.current?.selectionStart ?? -1;
  }

  splitQuery() {
    const {query} = this.state;
    const currentPosition = this.getCursorPosition();

    // The current term is delimited by whitespaces. So if no spaces are found,
    // the entire string is taken to be 1 term.
    //
    // TODO: add support for when there are no spaces

    const matches = [...query.substring(0, currentPosition).matchAll(/\s|^/g)];
    const match = matches[matches.length - 1];
    const startOfTerm = match[0] === '' ? 0 : (match.index || 0) + 1;

    const cursorOffset = query.slice(currentPosition).search(/\s|$/);
    const endOfTerm = currentPosition + (cursorOffset === -1 ? 0 : cursorOffset);

    return {
      startOfTerm,
      endOfTerm,
      prefix: query.substring(0, startOfTerm),
      term: query.substring(startOfTerm, endOfTerm),
      suffix: query.substring(endOfTerm),
    };
  }

  handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value.replace('\n', '');
    this.setState({query}, this.updateAutocompleteOptions);
  };

  handleClick = () => {
    this.updateAutocompleteOptions();
  };

  handleFocus = () => {
    this.setState({dropdownVisible: true});
  };

  handleBlur = () => {
    this.props.onUpdate(this.state.query);
    this.setState({dropdownVisible: false});
  };

  getSelection(selection: number): DropdownOption | null {
    const {dropdownOptionGroups} = this.state;

    for (const group of dropdownOptionGroups) {
      if (selection >= group.options.length) {
        selection -= group.options.length;
        continue;
      }

      return group.options[selection];
    }

    return null;
  }

  handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const {key} = event;

    const {options} = this.props;
    const {activeSelection, partialTerm} = this.state;
    const startedSelection = activeSelection >= 0;

    // handle arrow navigation
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();

      const newOptionGroups = makeOptions(options, partialTerm);
      const flattenedOptions = newOptionGroups.map(group => group.options).flat();
      if (flattenedOptions.length === 0) {
        return;
      }

      let newSelection;
      if (!startedSelection) {
        newSelection = key === 'ArrowUp' ? flattenedOptions.length - 1 : 0;
      } else {
        newSelection =
          key === 'ArrowUp'
            ? (activeSelection - 1 + flattenedOptions.length) % flattenedOptions.length
            : (activeSelection + 1) % flattenedOptions.length;
      }
      // This is modifying the `active` value of the references so make sure to
      // use `newOptionGroups` at the end.
      flattenedOptions[newSelection].active = true;

      this.setState({
        activeSelection: newSelection,
        dropdownOptionGroups: newOptionGroups,
      });
      return;
    }

    // handle selection
    if (startedSelection && (key === 'Tab' || key === 'Enter')) {
      event.preventDefault();

      const selection = this.getSelection(activeSelection);
      if (selection) {
        this.handleSelect(selection);
      }
      return;
    }

    if (key === 'Enter') {
      this.blur();
      return;
    }
  };

  handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Other keys are managed at handleKeyDown function
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();

    const {activeSelection} = this.state;
    const startedSelection = activeSelection >= 0;

    if (!startedSelection) {
      this.blur();
      return;
    }
  };

  handleSelect = (option: DropdownOption) => {
    const {prefix, suffix} = this.splitQuery();

    this.setState(
      {
        // make sure to insert a space after the autocompleted term
        query: `${prefix}${option.value} ${suffix}`,
        activeSelection: NONE_SELECTED,
      },
      () => {
        // updating the query will cause the input to lose focus
        // and make sure to move the cursor behind the space after
        // the end of the autocompleted term
        this.focus(prefix.length + option.value.length + 1);
        this.updateAutocompleteOptions();
      }
    );
  };

  updateAutocompleteOptions() {
    const {options} = this.props;

    const {term} = this.splitQuery();
    const partialTerm = term || null;

    this.setState({
      dropdownOptionGroups: makeOptions(options, partialTerm),
      partialTerm,
    });
  }

  render() {
    const {onUpdate: _onUpdate, options: _options, ...props} = this.props;
    const {dropdownVisible, dropdownOptionGroups} = this.state;
    return (
      <Container isOpen={dropdownVisible}>
        <StyledInput
          {...props}
          ref={this.input}
          autoComplete="off"
          className="form-control"
          value={this.state.query}
          onClick={this.handleClick}
          onChange={this.handleChange}
          onBlur={this.handleBlur}
          onFocus={this.handleFocus}
          onKeyDown={this.handleKeyDown}
          spellCheck={false}
        />
        <TermDropdown
          isOpen={dropdownVisible}
          optionGroups={dropdownOptionGroups}
          handleSelect={this.handleSelect}
        />
      </Container>
    );
  }
}

const Container = styled('div')<{isOpen: boolean}>`
  border: 1px solid ${p => p.theme.border};
  box-shadow: inset ${p => p.theme.dropShadowLight};
  background: ${p => p.theme.background};
  position: relative;

  border-radius: ${p =>
    p.isOpen
      ? `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`
      : p.theme.borderRadius};

  .show-sidebar & {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const StyledInput = styled(Input)`
  height: 40px;
  padding: 7px 10px;
  border: 0;
  box-shadow: none;

  &:hover,
  &:focus {
    border: 0;
    box-shadow: none;
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
      <DropdownItemsList>
        {optionGroups.map(group => {
          const {title, options} = group;
          return (
            <Fragment key={title}>
              <ListItem>
                <DropdownTitle>{title}</DropdownTitle>
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
                    ref={element =>
                      option.active && element?.scrollIntoView?.({block: 'nearest'})
                    }
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
      value: generateFieldAsString(option),
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
  partialTerm: string | null
): DropdownOptionGroup[] {
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
  background: ${p => p.theme.background};
  box-shadow: ${p => p.theme.dropShadowLight};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadiusBottom};
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
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const DropdownTitle = styled('header')`
  display: flex;
  align-items: center;

  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};

  margin: 0;
  padding: ${space(1)} ${space(2)};

  & > svg {
    margin-right: ${space(1)};
  }
`;

const DropdownListItem = styled(ListItem)`
  scroll-margin: 40px 0;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: ${space(1)} ${space(2)};
  cursor: pointer;

  &:hover,
  &.active {
    background: ${p => p.theme.hover};
  }
`;

const DropdownItemTitleWrapper = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  line-height: ${p => p.theme.text.lineHeightHeading};
  ${overflowEllipsis};
`;

const Info = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray300};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;
