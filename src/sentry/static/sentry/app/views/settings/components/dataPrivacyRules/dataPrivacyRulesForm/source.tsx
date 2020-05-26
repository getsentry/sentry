import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';
import TextOverflow from 'app/components/textOverflow';
import {defined} from 'app/utils';

import {
  unaryOperatorSuggestions,
  binaryOperatorSuggestions,
} from './dataPrivacyRulesFormSourceSuggestions';
import SourceSuggestionExamples from './sourceSuggestionExamples';
import {SourceSuggestion, SourceSuggestionType} from '../types';

type Props = {
  value: string;
  onChange: (value: string) => void;
  suggestions: Array<SourceSuggestion>;
  isRegExMatchesSelected: boolean;
  error?: string;
  onBlur?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
};

type State = {
  suggestions: Array<SourceSuggestion>;
  fieldValues: Array<SourceSuggestion | Array<SourceSuggestion>>;
  activeSuggestion: number;
  showSuggestions: boolean;
  hideCaret: boolean;
  help?: string;
};

class Source extends React.Component<Props, State> {
  state: State = {
    suggestions: [],
    fieldValues: [],
    activeSuggestion: 0,
    showSuggestions: false,
    hideCaret: false,
  };

  componentDidMount() {
    this.loadFieldValues(this.props.value);
    this.hideSuggestions();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.suggestions !== this.props.suggestions) {
      this.loadFieldValues(this.props.value);
      this.hideSuggestions();
    }

    if (
      prevProps.isRegExMatchesSelected !== this.props.isRegExMatchesSelected ||
      prevProps.value !== this.props.value
    ) {
      this.checkPossiblyRegExMatchExpression(this.props.value);
    }
  }

  selectorField = React.createRef<HTMLDivElement>();
  suggestionList = React.createRef<HTMLUListElement>();

  getAllSuggestions() {
    return [
      ...this.getValueSuggestions(),
      ...unaryOperatorSuggestions,
      ...binaryOperatorSuggestions,
    ];
  }

  getValueSuggestions() {
    return this.props.suggestions;
  }

  getFilteredSuggestions = (value: string, type: SourceSuggestionType) => {
    let valuesToBeFiltered: Array<SourceSuggestion> = [];

    switch (type) {
      case SourceSuggestionType.BINARY: {
        valuesToBeFiltered = binaryOperatorSuggestions;
        break;
      }
      case SourceSuggestionType.VALUE: {
        valuesToBeFiltered = this.getValueSuggestions();
        break;
      }
      case SourceSuggestionType.UNARY: {
        valuesToBeFiltered = unaryOperatorSuggestions;
        break;
      }
      default: {
        valuesToBeFiltered = [...this.getValueSuggestions(), ...unaryOperatorSuggestions];
      }
    }

    const filteredSuggestions = valuesToBeFiltered.filter(
      s => s.value.toLowerCase().indexOf(value.toLowerCase()) > -1
    );

    const showSuggestions = !(
      filteredSuggestions.length === 1 && filteredSuggestions[0].value === value
    );

    this.setState({
      showSuggestions,
    });

    return filteredSuggestions;
  };

  getNewSuggestions = (
    fieldValues: Array<SourceSuggestion | Array<SourceSuggestion>>
  ) => {
    const lastFieldValue = fieldValues[fieldValues.length - 1];
    const penultimateFieldValue = fieldValues[fieldValues.length - 2];

    if (Array.isArray(lastFieldValue)) {
      // recursion
      return this.getNewSuggestions(lastFieldValue);
    }

    if (Array.isArray(penultimateFieldValue)) {
      if (lastFieldValue?.type === 'binary') {
        // returns filtered values
        return this.getFilteredSuggestions(
          lastFieldValue?.value,
          SourceSuggestionType.VALUE
        );
      }
      // returns all binaries without any filter
      return this.getFilteredSuggestions('', SourceSuggestionType.BINARY);
    }

    if (lastFieldValue?.type === 'value' && penultimateFieldValue?.type === 'unary') {
      // returns filtered values
      return this.getFilteredSuggestions(
        lastFieldValue?.value,
        SourceSuggestionType.VALUE
      );
    }

    if (lastFieldValue?.type === 'unary') {
      // returns all values without any filter
      return this.getFilteredSuggestions('', SourceSuggestionType.VALUE);
    }

    if (lastFieldValue?.type === 'string' && penultimateFieldValue?.type === 'value') {
      // returns all binaries without any filter
      return this.getFilteredSuggestions('', SourceSuggestionType.BINARY);
    }

    if (
      lastFieldValue?.type === 'string' &&
      penultimateFieldValue?.type === 'string' &&
      !penultimateFieldValue?.value
    ) {
      // returns all values without any filter
      return this.getFilteredSuggestions('', SourceSuggestionType.STRING);
    }

    if (
      (penultimateFieldValue?.type === 'string' && !lastFieldValue?.value) ||
      (penultimateFieldValue?.type === 'value' && !lastFieldValue?.value) ||
      lastFieldValue?.type === 'binary'
    ) {
      // returns filtered binaries
      return this.getFilteredSuggestions(
        lastFieldValue?.value,
        SourceSuggestionType.BINARY
      );
    }

    return this.getFilteredSuggestions(lastFieldValue?.value, lastFieldValue?.type);
  };

  hideSuggestions = () => {
    this.setState({
      showSuggestions: false,
    });
  };

  loadFieldValues = (newValue: string) => {
    const fieldValues: Array<SourceSuggestion | Array<SourceSuggestion>> = [];

    const splittedValue = newValue.split(' ');

    for (const splittedValueIndex in splittedValue) {
      const value = splittedValue[splittedValueIndex];
      const lastFieldValue = fieldValues[fieldValues.length - 1];

      if (
        lastFieldValue &&
        !Array.isArray(lastFieldValue) &&
        !lastFieldValue.value &&
        !value
      ) {
        continue;
      }

      if (value.includes('!') && !!value.split('!')[1]) {
        const valueAfterUnaryOperator = value.split('!')[1];
        const selector = this.getAllSuggestions().find(
          s => s.value === valueAfterUnaryOperator
        );
        if (!selector) {
          fieldValues.push([
            unaryOperatorSuggestions[0],
            {type: SourceSuggestionType.STRING, value: valueAfterUnaryOperator},
          ]);
          continue;
        }
        fieldValues.push([unaryOperatorSuggestions[0], selector]);
        continue;
      }

      const selector = this.getAllSuggestions().find(s => s.value === value);
      if (selector) {
        fieldValues.push(selector);
        continue;
      }

      fieldValues.push({type: SourceSuggestionType.STRING, value});
    }

    const filteredSuggestions = this.getNewSuggestions(fieldValues);

    this.setState({
      fieldValues,
      activeSuggestion: 0,
      suggestions: filteredSuggestions,
    });
  };

  checkPossiblyRegExMatchExpression = (value: string) => {
    const {isRegExMatchesSelected} = this.props;
    const {help} = this.state;

    if (isRegExMatchesSelected) {
      if (help) {
        this.setState({help: ''});
      }
      return;
    }

    const isPossiblyARegularExpression = RegExp('^/.*/g?$').test(value);

    if (help) {
      if (!isPossiblyARegularExpression) {
        this.setState({
          help: '',
        });
      }
      return;
    }

    if (isPossiblyARegularExpression) {
      this.setState({
        help: t("You might want to change Data Type's value to 'Regex matches'"),
      });
    }
  };

  handleChange = (newValue: string) => {
    this.loadFieldValues(newValue);
    this.props.onChange(newValue);
  };

  handleClickOutside = () => {
    this.setState({
      showSuggestions: false,
      hideCaret: false,
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

  getNewFieldValues = (
    suggestion: SourceSuggestion
  ): Array<SourceSuggestion | Array<SourceSuggestion>> => {
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

  handleClickSuggestionItem = (suggestion: SourceSuggestion) => () => {
    const fieldValues = this.getNewFieldValues(suggestion);
    this.setState(
      {
        fieldValues,
        activeSuggestion: 0,
        showSuggestions: false,
        hideCaret: false,
      },
      () => {
        this.handleChangeParentValue();
      }
    );
  };

  scrollToSuggestion = () => {
    const {activeSuggestion, hideCaret} = this.state;

    this.suggestionList?.current?.children[activeSuggestion].scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });

    if (!hideCaret) {
      this.setState({
        hideCaret: true,
      });
    }
  };

  handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.persist();

    const {keyCode} = event;
    const {activeSuggestion, suggestions} = this.state;

    if (keyCode === 13) {
      this.handleClickSuggestionItem(suggestions[activeSuggestion])();
      return;
    }

    if (keyCode === 38) {
      if (activeSuggestion === 0) {
        return;
      }
      this.setState({activeSuggestion: activeSuggestion - 1}, () => {
        this.scrollToSuggestion();
      });
      return;
    }

    if (keyCode === 40) {
      if (activeSuggestion === suggestions.length - 1) {
        return;
      }
      this.setState({activeSuggestion: activeSuggestion + 1}, () => {
        this.scrollToSuggestion();
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
    const {error, disabled, value, onBlur} = this.props;
    const {showSuggestions, suggestions, activeSuggestion, hideCaret, help} = this.state;

    return (
      <Wrapper ref={this.selectorField} hideCaret={hideCaret}>
        <StyledTextField
          name="from"
          placeholder={t('Enter a custom attribute, variable or header name')}
          onChange={this.handleChange}
          autoComplete="off"
          value={value}
          onKeyDown={this.handleKeyDown}
          error={error}
          help={help}
          onBlur={onBlur}
          onFocus={this.handleFocus}
          disabled={disabled}
        />
        {showSuggestions && suggestions.length > 0 && (
          <React.Fragment>
            <SuggestionsWrapper
              ref={this.suggestionList}
              data-test-id="source-suggestions"
            >
              {suggestions.slice(0, 50).map((suggestion, index) => (
                <SuggestionItem
                  key={suggestion.value}
                  onClick={this.handleClickSuggestionItem(suggestion)}
                  active={index === activeSuggestion}
                  tabIndex={-1}
                >
                  <TextOverflow>{suggestion.value}</TextOverflow>

                  {suggestion.description && (
                    <SuggestionDescription>
                      (<TextOverflow>{suggestion.description}</TextOverflow>)
                    </SuggestionDescription>
                  )}

                  {suggestion.examples && suggestion.examples.length > 0 && (
                    <SourceSuggestionExamples
                      examples={suggestion.examples}
                      sourceName={suggestion.value}
                    />
                  )}
                </SuggestionItem>
              ))}
            </SuggestionsWrapper>
            <SuggestionsOverlay onClick={this.handleClickOutside} />
          </React.Fragment>
        )}
      </Wrapper>
    );
  }
}

export default Source;

const Wrapper = styled('div')<{hideCaret?: boolean}>`
  position: relative;
  width: 100%;
  ${p => p.hideCaret && `caret-color: transparent;`}
`;

const StyledTextField = styled(TextField)`
  width: 100%;
  height: 40px;
  input {
    height: 40px;
  }

  z-index: 1002;
  :focus {
    outline: none;
  }
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
  right: 0;
  z-index: 1002;
  overflow: hidden;
  max-height: 200px;
  overflow-y: auto;
`;

const SuggestionItem = styled('li')<{active: boolean}>`
  display: grid;
  grid-template-columns: auto 1fr max-content;
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

const SuggestionsOverlay = styled('div')`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
`;
