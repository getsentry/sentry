import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';
import TextOverflow from 'app/components/textOverflow';
import {defined} from 'app/utils';

import {
  allSelectors,
  unaryOperatorSuggestions,
  Suggestion,
  Suggestions,
} from './dataPrivacyRulesPanelSelectorFieldTypes';
import getNewSuggestions from './getNewSuggestions';

type State = {
  suggestions: Suggestions;
  fieldValues: Array<Suggestion | Array<Suggestion>>;
  activeSuggestion: number;
  showSuggestions: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onBlur?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
};

class DataPrivacyRulesPanelSelectorField extends React.Component<Props, State> {
  state: State = {
    suggestions: [],
    fieldValues: [],
    activeSuggestion: 0,
    showSuggestions: false,
  };

  componentWillMount() {
    document.addEventListener('mousedown', this.handleClickOutside, false);
  }

  componentDidMount() {
    this.loadFieldValues(this.props.value, true);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside, false);
  }

  selectorField = React.createRef<HTMLDivElement>();
  suggestionList = React.createRef<HTMLUListElement>();

  loadFieldValues = (newValue: string, initialLoading = false) => {
    const splittedValue = newValue.split(' ');
    const fieldValues: Array<Suggestion | Array<Suggestion>> = [];

    for (const splittedValueIndex in splittedValue) {
      const value = splittedValue[splittedValueIndex];

      if (value.includes('!') && !!value.split('!')[1]) {
        const valueAfterUnaryOperator = value.split('!')[1];
        const selector = allSelectors.find(s => s.value === valueAfterUnaryOperator);
        if (!selector) {
          fieldValues.push([
            unaryOperatorSuggestions[0],
            {type: 'string', value: valueAfterUnaryOperator},
          ]);
          continue;
        }
        fieldValues.push([unaryOperatorSuggestions[0], selector]);
        continue;
      }

      const selector = allSelectors.find(s => s.value === value);
      if (selector) {
        fieldValues.push(selector);
        continue;
      }

      fieldValues.push({type: 'string', value});
    }

    const {showSuggestions = true, filteredSuggestions} = getNewSuggestions(fieldValues);

    this.setState({
      fieldValues,
      activeSuggestion: 0,
      suggestions: filteredSuggestions,
      showSuggestions: initialLoading ? false : showSuggestions,
    });
  };

  handleChange = (newValue: string) => {
    this.loadFieldValues(newValue);
    this.props.onChange(newValue);
  };

  handleClickOutside = (event: MouseEvent) => {
    if (
      event.target instanceof HTMLElement &&
      this.selectorField.current &&
      this.selectorField.current.contains(event.target)
    ) {
      return;
    }

    this.setState({
      showSuggestions: false,
    });
  };

  handleChangeParentValue = () => {
    const {onChange} = this.props;
    const {fieldValues} = this.state;
    const newValue: Array<string> = [];

    for (const index in fieldValues) {
      const fieldValue = fieldValues[index];
      if (Array.isArray(fieldValue)) {
        newValue.push(`${fieldValue[0].value}${fieldValue[1].value}`);
        continue;
      }
      newValue.push(fieldValue.value);
    }

    onChange(newValue.join(' '));
  };

  getNewFieldValues = (suggestion: Suggestion): Array<Suggestion | Array<Suggestion>> => {
    const fieldValues = [...this.state.fieldValues];
    const lastFieldValue = fieldValues[fieldValues.length - 1];

    if (!defined(lastFieldValue)) {
      return [suggestion];
    }

    if (Array.isArray(lastFieldValue)) {
      fieldValues[fieldValues.length - 1] = [lastFieldValue[0], suggestion];
      return fieldValues;
    }

    if (lastFieldValue?.type === 'unary') {
      fieldValues[fieldValues.length - 1] = [lastFieldValue, suggestion];
    }

    if (lastFieldValue?.type === 'string') {
      fieldValues[fieldValues.length - 1] = suggestion;
    }

    return fieldValues;
  };

  handleClickSuggestionItem = (suggestion: Suggestion) => () => {
    const fieldValues = this.getNewFieldValues(suggestion);
    this.setState(
      {
        fieldValues,
        activeSuggestion: 0,
        showSuggestions: false,
      },
      () => {
        this.handleChangeParentValue();
      }
    );
  };

  scrollToSuggestion = () => {
    const {activeSuggestion} = this.state;
    this.suggestionList?.current?.children[activeSuggestion].scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  };

  handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const {fieldValues, activeSuggestion, suggestions} = this.state;

    if (event.keyCode === 8) {
      const lastFieldValue = fieldValues[fieldValues.length - 1];
      if (Array.isArray(lastFieldValue) && lastFieldValue[1].value.length === 1) {
        this.setState({
          fieldValues: [...fieldValues, lastFieldValue[0]],
        });
      }
      return;
    }

    if (event.keyCode === 13) {
      this.handleClickSuggestionItem(suggestions[activeSuggestion])();
      return;
    }

    if (event.keyCode === 38) {
      if (activeSuggestion === 0) {
        return;
      }
      this.setState({activeSuggestion: activeSuggestion - 1}, () => {
        this.scrollToSuggestion();
      });
      return;
    }

    if (event.keyCode === 40) {
      if (activeSuggestion === suggestions.length - 1) {
        return;
      }
      this.setState({activeSuggestion: activeSuggestion + 1}, () => {
        this.scrollToSuggestion();
      });
      return;
    }

    if (event.keyCode === 32) {
      this.setState({
        fieldValues: [...fieldValues, {value: ' ', type: 'string'}],
      });
      return;
    }
  };

  handleFocus = () => {
    this.setState({
      showSuggestions: true,
    });
  };

  render() {
    const {error, onBlur, disabled, value} = this.props;
    const {showSuggestions, suggestions, activeSuggestion} = this.state;

    return (
      <Wrapper ref={this.selectorField}>
        <StyledTextField
          name="from"
          placeholder={t('ex. strings, numbers, custom')}
          onChange={this.handleChange}
          autoComplete="off"
          value={value}
          onKeyDown={this.handleKeyDown}
          error={error}
          onBlur={onBlur}
          onFocus={this.handleFocus}
          disabled={disabled}
        />
        {showSuggestions && suggestions.length > 0 && (
          <SuggestionsWrapper ref={this.suggestionList}>
            {suggestions.map((suggestion, index) => (
              <SuggestionItem
                key={suggestion.value}
                onClick={this.handleClickSuggestionItem(suggestion)}
                active={index === activeSuggestion}
                tabIndex={-1}
              >
                <TextOverflow>{suggestion.value}</TextOverflow>
                {suggestion?.description && (
                  <SuggestionDescription>
                    (<TextOverflow>{suggestion.description}</TextOverflow>)
                  </SuggestionDescription>
                )}
              </SuggestionItem>
            ))}
          </SuggestionsWrapper>
        )}
      </Wrapper>
    );
  }
}

export default DataPrivacyRulesPanelSelectorField;

const Wrapper = styled('div')`
  position: relative;
  width: 100%;
`;

const StyledTextField = styled(TextField)<{error?: string}>`
  width: 100%;
  height: 34px;
  font-size: ${p => p.theme.fontSizeSmall};
  input {
    height: 34px;
  }
  ${p =>
    !p.error &&
    `
      margin-bottom: 0;
    `}
`;

const SuggestionsWrapper = styled('ul')`
  position: absolute;
  width: 100%;
  padding-left: 0;
  list-style: none;
  margin-bottom: 0;
  box-shadow: 0 2px 0 rgba(37, 11, 54, 0.04);
  border: 1px solid ${p => p.theme.borderDark};
  border-radius: 0 0 ${space(0.5)} ${space(0.5)};
  background: ${p => p.theme.white};
  top: 35px;
  z-index: 1001;
  overflow: hidden;
  max-height: 200px;
  overflow-y: auto;
`;

const SuggestionItem = styled('li')<{active: boolean}>`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-gap: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  cursor: pointer;
  background: ${p => (p.active ? p.theme.offWhiteLight : p.theme.white)};
  :hover {
    background: ${p => (p.active ? p.theme.offWhiteLight : p.theme.offWhite)};
  }
`;

const SuggestionDescription = styled('div')`
  display: flex;
  overflow: hidden;
  color: ${p => p.theme.gray2};
`;
