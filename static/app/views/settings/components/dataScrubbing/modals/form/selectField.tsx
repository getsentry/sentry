import {Component, createRef} from 'react';

import SelectControl, {
  ControlProps,
} from 'sentry/components/forms/controls/selectControl';

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
        ref={this.selectRef}
        openOnFocus
      />
    );
  }
}

export default SelectField;
