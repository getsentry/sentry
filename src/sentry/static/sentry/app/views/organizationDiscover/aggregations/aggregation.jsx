import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';
import SelectControl from 'app/components/forms/selectControl';
import {t} from 'app/locale';

import {getInternal, getExternal} from './utils';
import {TOPK_COUNTS} from '../data';
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
      {value: 'topK', label: 'topK(...)'},
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

    if (input.startsWith('topK')) {
      optionList = TOPK_COUNTS.map(num => ({
        value: `topK(${num})`,
        label: `topK(${num})(...)`,
      }));
    }

    const topKValueMatch = input.match(/^topK\((\d+)\)/);

    if (topKValueMatch) {
      const count = topKValueMatch[1];

      optionList = this.props.columns.map(({name}) => ({
        value: `topK(${count})(${name})`,
        label: `topK(${count})(${name})`,
      }));
    }

    return optionList.filter(({label}) => label.includes(input));
  };

  focus() {
    this.select.focus();
  }

  handleChange = option => {
    const topKValues = new Set([...TOPK_COUNTS.map(num => `topK(${num})`)]);

    if (option.value === 'uniq' || option.value === 'avg' || option.value === 'topK') {
      this.setState({inputValue: option.value}, this.focus);
    } else if (topKValues.has(option.value)) {
      this.setState(
        {
          inputValue: option.value,
        },
        this.focus
      );
    } else {
      this.setState({inputValue: option.value});
      this.props.onChange(getExternal(option.value));
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
          forwardedRef={ref => (this.select = ref)}
          value={getInternal(this.props.value)}
          placeholder={
            <PlaceholderText>{t('Add aggregation function...')}</PlaceholderText>
          }
          options={this.getOptions()}
          filterOptions={this.filterOptions}
          onChange={this.handleChange}
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
