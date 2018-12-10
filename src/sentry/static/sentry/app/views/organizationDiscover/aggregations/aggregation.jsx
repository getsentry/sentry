import React from 'react';

import {Value} from 'react-select';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';
import SelectControl from 'app/components/forms/selectControl';
import {t} from 'app/locale';

import {getInternal, getExternal} from './utils';
import {PlaceholderText} from '../styles';
import {ARRAY_FIELD_PREFIXES} from '../data';

export default class Aggregation extends React.Component {
  static propTypes = {
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    columns: PropTypes.array.isRequired,
    disabled: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      inputValue: '',
      isOpen: false,
    };
  }

  getOptions() {
    const currentValue = getInternal(this.props.value);
    const shouldDisplayValue = currentValue || this.state.inputValue;
    return shouldDisplayValue ? [{label: currentValue, value: currentValue}] : [];
  }

  filterOptions = () => {
    const input = this.state.inputValue;

    let optionList = [
      {value: 'count', label: 'count'},
      {value: 'uniq', label: 'uniq(...)'},
      {value: 'avg', label: 'avg(...)'},
    ];

    if (input.startsWith('uniq')) {
      optionList = this.props.columns
        .filter(({name}) => !ARRAY_FIELD_PREFIXES.some(prefix => name.startsWith(prefix)))
        .map(({name}) => ({
          value: `uniq(${name})`,
          label: `uniq(${name})`,
        }));
    }

    if (input.startsWith('avg')) {
      optionList = this.props.columns
        .filter(({type}) => type === 'number')
        .map(({name}) => ({
          value: `avg(${name})`,
          label: `avg(${name})`,
        }));
    }

    return optionList.filter(({label}) => label.includes(input));
  };

  focus() {
    this.select.focus();
  }

  handleChange = option => {
    if (option.value === 'uniq' || option.value === 'avg') {
      this.setState({inputValue: option.value}, this.focus);
    } else {
      this.setState({inputValue: option.value, isOpen: false});
      this.props.onChange(getExternal(option.value));
    }
  };

  handleOpen = () => {
    if (this.state.inputValue === '') {
      this.setState({
        inputValue: getInternal(this.props.value),
        isOpen: true,
      });
    }
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
        style={{width: '100%', border: 0, backgroundColor: 'transparent'}}
      />
    );
  };

  valueComponent = props => {
    if (this.state.isOpen) {
      return null;
    }

    return <Value {...props} />;
  };

  handleInputChange = value => {
    this.setState({
      inputValue: value,
    });
  };

  render() {
    return (
      <Box w={1}>
        <SelectControl
          innerRef={ref => (this.select = ref)}
          value={getInternal(this.props.value)}
          placeholder={
            <PlaceholderText>{t('Add aggregation function...')}</PlaceholderText>
          }
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
          inputRenderer={this.inputRenderer}
          valueComponent={this.valueComponent}
          onInputChange={this.handleInputChange}
          disabled={this.props.disabled}
        />
      </Box>
    );
  }
}
