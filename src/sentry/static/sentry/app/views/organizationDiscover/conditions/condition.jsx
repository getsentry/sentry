import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';
import {t} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';

import {getInternal, getExternal, isValidCondition} from './utils';
import {CONDITION_OPERATORS, ARRAY_FIELD_PREFIXES} from '../data';
import {PlaceholderText} from '../styles';

export default class Condition extends React.Component {
  static propTypes = {
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    columns: PropTypes.arrayOf(
      PropTypes.shape({name: PropTypes.string, type: PropTypes.string})
    ).isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      inputValue: '',
    };
  }

  focus() {
    this.select.focus();
  }

  handleChange = option => {
    const external = getExternal(option.value, this.props.columns);

    if (isValidCondition(external, this.props.columns)) {
      this.setState(
        {
          inputValue: '',
        },
        this.props.onChange(external)
      );

      return;
    }

    this.setState(
      {
        inputValue: option.value,
      },
      this.focus
    );
  };

  handleOpen = () => {
    if (this.state.inputValue === '') {
      this.setState({
        inputValue: getInternal(this.props.value),
      });
    }
  };

  getOptions() {
    const currentValue = getInternal(this.props.value);
    const shouldDisplayValue = currentValue || this.state.inputValue;
    return shouldDisplayValue ? [{label: currentValue, value: currentValue}] : [];
  }

  getConditionsForColumn(colName) {
    const column = this.props.columns.find(({name}) => name === colName);
    const colType = column ? column.type : 'string';
    const numberOnlyOperators = new Set(['>', '<', '>=', '<=']);
    const stringOnlyOperators = new Set(['LIKE', 'NOT LIKE']);

    return CONDITION_OPERATORS.filter(operator => {
      if (colType === 'number' || colType === 'datetime') {
        return !stringOnlyOperators.has(operator);
      }

      // We currently only support = and != on array fields
      if (ARRAY_FIELD_PREFIXES.some(prefix => colName.startsWith(prefix))) {
        return ['=', '!='].includes(operator);
      }

      // Treat everything else like a string
      return !numberOnlyOperators.has(operator);
    });
  }

  filterOptions = (options, input) => {
    input = input || this.state.inputValue;

    let optionList = options;
    const external = getExternal(input, this.props.columns);
    const isValid = isValidCondition(external, this.props.columns);

    if (isValid) {
      return [];
    }

    const hasSelectedColumn = external[0] !== null;
    const hasSelectedOperator = external[1] !== null;

    if (!hasSelectedColumn) {
      optionList = this.props.columns.map(({name}) => ({
        value: `${name}`,
        label: `${name}...`,
      }));
    }

    if (hasSelectedColumn && !hasSelectedOperator) {
      const selectedColumn = external[0];
      optionList = this.getConditionsForColumn(selectedColumn).map(op => {
        const value = `${selectedColumn} ${op}`;
        return {
          value,
          label: value,
        };
      });
    }

    return optionList.filter(({label}) => label.includes(input));
  };

  isValidNewOption = ({label}) => {
    return isValidCondition(getExternal(label, this.props.columns), this.props.columns);
  };

  inputRenderer = props => {
    return (
      <input
        type="text"
        {...props}
        value={this.state.inputValue}
        style={{width: '100%', border: 0, zIndex: 1000, backgroundColor: 'transparent'}}
      />
    );
  };

  valueRenderer = option => {
    const hideValue = this.state.inputValue;
    return hideValue ? '' : option.value;
  };

  shouldKeyDownEventCreateNewOption = keyCode => {
    const createKeyCodes = new Set([13, 9]); // ENTER, TAB
    return createKeyCodes.has(keyCode);
  };

  handleInputChange = value => {
    this.setState({
      inputValue: value,
    });

    return value;
  };

  render() {
    return (
      <Box w={1}>
        <SelectControl
          innerRef={ref => (this.select = ref)}
          value={getInternal(this.props.value)}
          placeholder={<PlaceholderText>{t('Add condition...')}</PlaceholderText>}
          options={this.getOptions()}
          filterOptions={this.filterOptions}
          onChange={this.handleChange}
          onOpen={this.handleOpen}
          closeOnSelect={true}
          openOnFocus={true}
          autoBlur={true}
          clearable={false}
          backspaceRemoves={false}
          deleteRemoves={false}
          isValidNewOption={this.isValidNewOption}
          inputRenderer={this.inputRenderer}
          valueRenderer={this.valueRenderer}
          onInputChange={this.handleInputChange}
          creatable={true}
          promptTextCreator={text => text}
          shouldKeyDownEventCreateNewOption={this.shouldKeyDownEventCreateNewOption}
        />
      </Box>
    );
  }
}
