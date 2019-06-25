import React from 'react';
import {Value} from 'react-select';
import {Box} from 'grid-emotion';

import {t} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';

import {getInternal, getExternal} from './utils';
import {
  SnubaResult,
  ReactSelectState,
  DiscoverBaseProps,
  ReactSelectValue,
} from '../types';
import {PlaceholderText} from '../styles';
import {ARRAY_FIELD_PREFIXES} from '../data';

type AggregationProps = DiscoverBaseProps & {
  value: SnubaResult;
  onChange: (value: SnubaResult) => void;
};

const initalState = {
  inputValue: '',
  isOpen: false,
};

export default class Aggregation extends React.Component<
  AggregationProps,
  ReactSelectState
> {
  // This is the ref of the inner react-select component
  private select: any;

  state = initalState;

  getOptions() {
    const currentValue = getInternal(this.props.value);
    const shouldDisplayValue = currentValue || this.state.inputValue;
    return shouldDisplayValue ? [{label: currentValue, value: currentValue}] : [];
  }

  filterOptions = () => {
    const input = this.state.inputValue;

    let optionList: Array<ReactSelectValue> = [
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

  handleChange = (option: any) => {
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

  inputRenderer = (props: AggregationProps) => {
    const onChange = (evt: any) => {
      if (evt && evt.target && evt.target.value === '') {
        // React select won't trigger an onChange event when a value is completely
        // cleared, so we'll force this before calling onChange
        this.setState({inputValue: evt.target.value}, () => {
          props.onChange(evt);
        });
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

  valueComponent = (props: AggregationProps) => {
    if (this.state.isOpen) {
      return null;
    }

    return <Value {...props} />;
  };

  handleInputChange = (value: any) => {
    this.setState({
      inputValue: value,
    });
  };

  render() {
    return (
      <div>
        <SelectControl
          innerRef={(ref: any) => (this.select = ref)}
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
      </div>
    );
  }
}
