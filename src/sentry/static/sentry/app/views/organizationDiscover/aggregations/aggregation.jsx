import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';
import SelectControl from 'app/components/forms/selectControl';

import {getInternal, getExternal} from './utils';
import {TOPK_COUNTS} from '../data';

export default class Aggregation extends React.Component {
  static propTypes = {
    value: PropTypes.array,
    onChange: PropTypes.func,
    columns: PropTypes.array,
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedFunction: null,
    };
  }

  getOptions() {
    const currentValue = getInternal(this.props.value);
    return [{label: currentValue, value: currentValue}];
  }

  filterOptions = (options, input, value) => {
    input = input || this.state.selectedFunction || '';

    let optionList = [
      {value: 'count', label: 'count'},
      {value: 'uniq', label: 'uniq(...)'},
      {value: 'topK', label: 'topK(...)'},
    ];

    if (input.startsWith('uniq')) {
      optionList = this.props.columns.map(({name}) => ({
        value: `uniq(${name})`,
        label: `uniq(${name})`,
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

    if (option.value === 'uniq' || option.value === 'topK') {
      this.setState({selectedFunction: option.value}, this.focus);
    } else if (topKValues.has(option.value)) {
      this.setState(
        {
          selectedFunction: option.value,
        },
        this.focus
      );
    } else {
      this.setState({selectedFunction: null}, () => {
        this.props.onChange(getExternal(option.value));
      });
    }
  };

  handleClose = () => {
    this.setState({selectedFunction: null});
  };

  inputRenderer = props => {
    const val = `${this.state.selectedFunction || ''}`.trim();

    return (
      <input
        type="text"
        {...props}
        value={props.value || val}
        style={{width: '100%', border: 0}}
      />
    );
  };

  valueRenderer = option => {
    const hideValue = this.state.selectedFunction;
    return hideValue ? '' : option.value;
  };

  handleInputChange = value => {
    return value;
  };

  render() {
    const value = getInternal(this.props.value);
    return (
      <Box w={1}>
        <SelectControl
          forwardedRef={ref => (this.select = ref)}
          value={value}
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
          inputRenderer={this.inputRenderer}
          valueRenderer={this.valueRenderer}
          onInputChange={this.handleInputChange}
        />
      </Box>
    );
  }
}
