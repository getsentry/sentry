import {Component, createRef} from 'react';
import {components, OptionProps} from 'react-select';
import styled from '@emotion/styled';

import SelectControl, {ControlProps} from 'sentry/components/forms/selectControl';
import space from 'sentry/styles/space';

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
        styles={{
          control: (provided: {[x: string]: string | number | boolean}) => ({
            ...provided,
            minHeight: '41px',
            height: '41px',
          }),
        }}
        ref={this.selectRef}
        components={{
          Option: ({
            data: {label, description, ...data},
            isSelected,
            ...props
          }: OptionProps<{
            label: React.ReactNode;
            value: string;
            description?: string;
          }>) => (
            <components.Option isSelected={isSelected} data={data} {...props}>
              <Wrapper>
                <div data-test-id="label">{label}</div>
                {description && <Description>{`(${description})`}</Description>}
              </Wrapper>
            </components.Option>
          ),
        }}
        openOnFocus
      />
    );
  }
}

export default SelectField;

const Description = styled('div')`
  color: ${p => p.theme.gray300};
`;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${space(1)};
`;
