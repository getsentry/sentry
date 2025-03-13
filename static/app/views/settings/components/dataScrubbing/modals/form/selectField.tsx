import {Component, createRef} from 'react';

import type {ControlProps} from 'sentry/components/core/select';
import {Select} from 'sentry/components/core/select';

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
      <Select
        {...this.props}
        isSearchable={false}
        options={this.props.options.map((opt: any) => ({
          ...opt,
          details: opt.description ? `(${opt.description})` : undefined,
        }))}
        ref={this.selectRef}
        openOnFocus
      />
    );
  }
}

export default SelectField;
