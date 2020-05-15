import React from 'react';
import styled from '@emotion/styled';
// eslint import checks can't find types in the flow code.
// eslint-disable-next-line import/named
import {components, OptionProps} from 'react-select';

import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';

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

    if (this.selectRef.current?.select?.inputRef) {
      this.selectRef.current.select.inputRef.autocomplete = 'off';
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
        components={{
          Option: ({
            data: {label, description, ...data},
            ...props
          }: OptionProps<{
            label: React.ReactNode;
            value: string;
            description?: string;
          }>) => (
            <components.Option data={{label, ...data}} {...props}>
              <Wrapper>
                <div>{label}</div>
                {description && <Description>{`(${description})`}</Description>}
              </Wrapper>
            </components.Option>
          ),
        }}
        openOnFocus
        required
      />
    );
  }
}

export default DataPrivacyRulesPanelFormSelectControl;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  grid-gap: ${space(1)};
`;

const Description = styled('div')`
  color: ${p => p.theme.gray2};
`;
