import {Component, createRef} from 'react';

import type {ControlProps} from 'sentry/components/forms/selectControl';
import SelectControl from 'sentry/components/forms/selectControl';

type Props = Pick<
  ControlProps,
  'value' | 'placeholder' | 'name' | 'onChange' | 'options'
>;

class SelectField extends Component<Props> {
  componentDidMount() {
    if (!this.selectRef.current) {
      return;
    }

    if (this.selectRef.current?.select?.inputRef) {
      this.selectRef.current.select.inputRef.autocomplete = 'off';
    }
  }

  // TODO(ts) The generics in react-select make getting a good type here hard.
  selectRef = createRef<any>();

  render() {
    return (
      <SelectControl
        {...this.props}
        isSearchable={false}
        options={this.props.options.map(opt => ({
          ...opt,
          details: opt.description ? `(${opt.description})` : undefined,
        }))}
        styles={{
          control: (provided: {[x: string]: string | number | boolean}) => ({
            ...provided,
            minHeight: '41px',
            height: '41px',
          }),
        }}
        ref={this.selectRef}
        openOnFocus
      />
    );
  }
}

export default SelectField;
