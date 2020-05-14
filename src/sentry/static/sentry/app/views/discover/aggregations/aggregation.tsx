import React from 'react';
import {Value} from 'react-select-legacy';

import {t} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';

import {getInternal, getExternal} from './utils';
import {Aggregation, DiscoverBaseProps, ReactSelectOption} from '../types';
import {PlaceholderText} from '../styles';
import {ARRAY_FIELD_PREFIXES} from '../data';

type AggregationProps = DiscoverBaseProps & {
  value: Aggregation;
  onChange: (value: Aggregation) => void;
};

type AggregationState = {
  inputValue: string;
  isOpen: boolean;
};

const initialState = {
  inputValue: '',
  isOpen: false,
};

export default class AggregationRow extends React.Component<
  AggregationProps,
  AggregationState
> {
  state = initialState;

  // This is the ref of the inner react-select component
  private select: any;

  getOptions() {
    const currentValue = getInternal(this.props.value);
    const shouldDisplayValue = currentValue || this.state.inputValue;
    return shouldDisplayValue ? [{label: currentValue, value: currentValue}] : [];
  }

  filterOptions = () => {
    const input = this.state.inputValue;

    let optionList: Array<ReactSelectOption> = [
      {value: 'count', label: 'count'},
      {value: 'uniq', label: 'uniq(...)'},
      {value: 'avg', label: 'avg(...)'},
      {value: 'sum', label: 'sum(...)'},
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

    if (input.startsWith('sum')) {
      optionList = this.props.columns
        .filter(({type}) => type === 'number')
        .map(({name}) => ({
          value: `sum(${name})`,
          label: `sum(${name})`,
        }));
    }

    return optionList.filter(({label}) => label.includes(input));
  };

  focus() {
    this.select.focus();
  }

  handleChange = (option: ReactSelectOption) => {
    if (option.value === 'uniq' || option.value === 'avg' || option.value === 'sum') {
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
        evt.persist();
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

  handleInputChange = (value: string) => {
    this.setState({
      inputValue: value,
    });
  };

  render() {
    return (
      <div>
        <SelectControl
          deprecatedSelectControl
          ref={(ref: any) => (this.select = ref)}
          value={getInternal(this.props.value)}
          placeholder={
            <PlaceholderText>{t('Add aggregation function...')}</PlaceholderText>
          }
          options={this.getOptions()}
          filterOptions={this.filterOptions}
          onChange={this.handleChange}
          onOpen={this.handleOpen}
          closeOnSelect
          openOnFocus
          autoBlur
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
