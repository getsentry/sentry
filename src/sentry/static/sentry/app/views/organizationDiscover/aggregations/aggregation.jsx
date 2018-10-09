import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';
import SelectControl from 'app/components/forms/selectControl';
import {t} from 'app/locale';

import {getInternal, getExternal} from './utils';
import {PlaceholderText} from '../styles';

export default class Aggregation extends React.Component {
  static propTypes = {
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    columns: PropTypes.array.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      inputValue: '',
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
      optionList = this.props.columns.map(({name}) => ({
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
      this.setState({inputValue: option.value});
      this.props.onChange(getExternal(option.value));
    }
  };

  handleOpen = () => {
    if (this.state.inputValue === '') {
      this.setState({
        inputValue: getInternal(this.props.value),
      });
    }
  };

  inputRenderer = props => {
    return (
      <input
        type="text"
        {...props}
        value={props.value || this.state.inputValue}
        style={{width: '100%', border: 0}}
      />
    );
  };

  valueRenderer = option => {
    const hideValue = this.state.inputValue;
    return hideValue ? '' : option.value;
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
          valueRenderer={this.valueRenderer}
          onInputChange={this.handleInputChange}
        />
      </Box>
    );
  }
}
