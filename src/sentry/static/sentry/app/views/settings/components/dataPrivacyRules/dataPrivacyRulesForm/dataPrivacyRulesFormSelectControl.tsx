import React from 'react';

import SelectControl from 'app/components/forms/selectControl';

type SelectControlProps = React.ComponentProps<typeof SelectControl>;

type Props = Pick<
  SelectControlProps,
  'value' | 'placeholder' | 'name' | 'onChange' | 'options' | 'isDisabled'
>;

class DataPrivacyRulesPanelFormSelectControl extends React.Component<Props> {
  componentDidMount() {
    if (!this.selectRef.current) {
      return;
    }

    if (this.selectRef.current?.select) {
      const input = this.selectRef.current.select?.inputRef;
      if (input) {
        input.autocomplete = 'off';
      }
    }
  }

  selectRef = React.createRef<typeof SelectControl>();

  render() {
    return (
      <SelectControl
        {...this.props}
        isSearchable={false}
        styles={{
          control: (provided: {[x: string]: string | number | boolean}) => ({
            ...provided,
            minHeight: '40px',
            height: '40px',
          }),
        }}
        ref={this.selectRef}
        openOnFocus
        required
      />
    );
  }
}

export default DataPrivacyRulesPanelFormSelectControl;
