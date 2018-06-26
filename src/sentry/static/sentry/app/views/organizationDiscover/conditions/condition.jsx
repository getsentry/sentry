import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';

import SelectControl from 'app/components/forms/selectControl';

import {getInternal, getExternal, isValidCondition} from './utils';
import {CONDITION_OPERATORS} from '../data';

export default class Condition extends React.Component {
  static propTypes = {
    value: PropTypes.array,
    onChange: PropTypes.func,
    columns: PropTypes.array,
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedColumn: null,
      selectedOperator: null,
    };
  }

  focus() {
    this.select.focus();
  }

  handleChange = option => {
    const external = getExternal(option.value, this.props.columns);

    if (isValidCondition(external, this.props.columns)) {
      this.props.onChange(external);
      return;
    }

    if (new Set(this.props.columns.map(({name}) => name)).has(external[0])) {
      this.setState({selectedColumn: external[0]}, this.focus);
    }

    if (new Set(CONDITION_OPERATORS).has(external[1])) {
      this.setState({selectedOperator: external[1]}, this.focus);
    }
  };

  handleClose = () => {
    this.setState({selectedColumn: null, selectedOperator: null});
  };

  getOptions() {
    const currentValue = getInternal(this.props.value);
    return [{label: currentValue, value: currentValue}];
  }

  getConditionsForColumn(colName) {
    const column = this.props.columns.find(({name}) => name === colName);
    const colType = column ? column.type : 'string';
    const numberOnlyOperators = new Set(['>', '<', '>=', '<=']);
    const stringOnlyOperators = new Set(['LIKE']);

    return CONDITION_OPERATORS.filter(operator => {
      if (colType === 'number') {
        return !stringOnlyOperators.has(operator);
      } else {
        return !numberOnlyOperators.has(operator);
      }
    });
  }

  filterOptions = (options, input) => {
    input =
      input ||
      `${this.state.selectedColumn || ''} ${this.state.selectedOperator || ''}`.trim();

    let optionList = options;
    const external = getExternal(input, this.props.columns);
    const isValid = isValidCondition(external, this.props.columns);

    if (isValid) {
      return [];
    }

    const hasSelectedColumn = external[0] !== null || this.state.selectedColumn !== null;
    const hasSelectedOperator =
      external[1] !== null || this.state.selectedOperator !== null;

    if (!hasSelectedColumn) {
      optionList = this.props.columns.map(({name}) => ({
        value: `${name}`,
        label: `${name}...`,
      }));
    }

    if (hasSelectedColumn && !hasSelectedOperator) {
      const selectedColumn = external[0] || this.state.selectedColumn;
      optionList = this.getConditionsForColumn(selectedColumn).map(op => {
        const value = `${external[0] || this.state.selectedColumn} ${op}`;
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
    let val = `${this.state.selectedColumn || ''} ${this.state.selectedOperator ||
      ''}`.trim();

    return (
      <input
        id="custom-input"
        type="text"
        {...props}
        value={props.value || val}
        style={{width: '100%', border: 0}}
      />
    );
  };

  valueRenderer = option => {
    const hideValue = this.state.selectedColumn || this.state.selectedOperator;

    return hideValue ? '' : option.value;
  };

  shouldKeyDownEventCreateNewOption = keyCode => {
    const createKeyCodes = new Set([13, 9]); // ENTER, TAB
    return createKeyCodes.has(keyCode);
  };

  onInputChange = value => {
    const external = getExternal(value, this.props.columns);

    if (!external[0] && this.state.selectedColumn) {
      this.setState({
        selectedColumn: null,
      });
    }

    if (!external[1] && this.state.selectedOperator) {
      this.setState({
        selectedOperator: null,
      });
    }

    return value;
  };

  render() {
    return (
      <Box w={1}>
        <SelectControl
          forwardedRef={ref => (this.select = ref)}
          value={getInternal(this.props.value)}
          options={this.getOptions()}
          filterOptions={this.filterOptions}
          onChange={this.handleChange}
          closeOnSelect={true}
          openOnFocus={true}
          autoBlur={true}
          clearable={false}
          backspaceRemoves={false}
          deleteRemoves={false}
          onClose={this.handleClose}
          creatable={true}
          promptTextCreator={text => text}
          isValidNewOption={this.isValidNewOption}
          inputRenderer={this.inputRenderer}
          valueRenderer={this.valueRenderer}
          shouldKeyDownEventCreateNewOption={this.shouldKeyDownEventCreateNewOption}
          onInputChange={this.onInputChange}
        />
      </Box>
    );
  }
}
