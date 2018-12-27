import React from 'react';
import {Value} from 'react-select';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';
import {t} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';

import {getInternal, getExternal, isValidCondition, ignoreCase} from './utils';
import {CONDITION_OPERATORS, ARRAY_FIELD_PREFIXES} from '../data';
import {PlaceholderText} from '../styles';

export default class Condition extends React.Component {
  static propTypes = {
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    columns: PropTypes.arrayOf(
      PropTypes.shape({name: PropTypes.string, type: PropTypes.string})
    ).isRequired,
    disabled: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      inputValue: '',
      isOpen: false,
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
          isOpen: false,
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
        isOpen: true,
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

  filterOptions = options => {
    const input = this.state.inputValue;

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
    label = ignoreCase(label);
    return isValidCondition(getExternal(label, this.props.columns), this.props.columns);
  };

  inputRenderer = props => {
    const onChange = evt => {
      if (evt.target.value === '') {
        // React select won't trigger an onChange event when a value is completely
        // cleared, so we'll force this before calling onChange
        this.setState({inputValue: evt.target.value}, props.onChange(evt));
      } else {
        props.onChange(evt);
      }
    };

    return (
      <input
        type="text"
        {...props}
        onChange={onChange}
        value={this.state.inputValue}
        style={{width: '100%', border: 0, zIndex: 1000, backgroundColor: 'transparent'}}
      />
    );
  };

  valueComponent = props => {
    if (this.state.inputValue) {
      return null;
    }

    return <Value {...props} />;
  };

  shouldKeyDownEventCreateNewOption = keyCode => {
    const createKeyCodes = new Set([13, 9]); // ENTER, TAB
    return createKeyCodes.has(keyCode);
  };

  handleInputChange = value => {
    this.setState({
      inputValue: ignoreCase(value),
    });

    return value;
  };

  handleBlur = evt => {
    const external = getExternal(evt.target.value, this.props.columns);
    const isValid = isValidCondition(external, this.props.columns);
    if (isValid) {
      this.setState(
        {
          inputValue: '',
        },
        this.props.onChange(external)
      );
    }
  };

  newOptionCreator = ({label, labelKey, valueKey}) => {
    label = ignoreCase(label);
    return {
      [valueKey]: label,
      [labelKey]: label,
    };
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
          valueComponent={this.valueComponent}
          onInputChange={this.handleInputChange}
          onBlur={this.handleBlur}
          creatable={true}
          promptTextCreator={text => text}
          shouldKeyDownEventCreateNewOption={this.shouldKeyDownEventCreateNewOption}
          disabled={this.props.disabled}
          newOptionCreator={this.newOptionCreator}
        />
      </Box>
    );
  }
}
