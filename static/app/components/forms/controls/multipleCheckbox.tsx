import {createContext, ReactNode, useCallback, useContext, useMemo} from 'react';
import styled from '@emotion/styled';
import noop from 'lodash/noop';

import Checkbox from 'sentry/components/checkbox';
import {space} from 'sentry/styles/space';

type CheckboxValue = string | number;

type SelectedValue = CheckboxValue[];

type Props = {
  children: ReactNode;
  name: string;
  value: (string | number)[];
  disabled?: boolean;
  onChange?: (value: SelectedValue, event: React.ChangeEvent<HTMLInputElement>) => void;
};

type CheckboxItemProps = {
  children: ReactNode;
  value: string | number;
  disabled?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

type MultipleCheckboxContextValue = {
  disabled: Props['disabled'];
  handleChange: (
    itemValue: CheckboxValue,
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  name: string;
  value: Props['value'];
};

const MultipleCheckboxContext = createContext<MultipleCheckboxContextValue>({
  handleChange: noop,
  value: [],
  name: '',
  disabled: false,
});

function MultipleCheckbox({children, value, disabled, onChange, name}: Props) {
  const handleChange = useCallback(
    (itemValue: CheckboxValue, e: React.ChangeEvent<HTMLInputElement>) => {
      if (typeof onChange !== 'function') {
        return;
      }

      const newValue = e.target.checked
        ? [...value, itemValue]
        : value.filter(v => v !== itemValue);

      onChange(newValue, e);
    },
    [value, onChange]
  );

  const contextValue = useMemo(
    () => ({
      value,
      handleChange,
      name,
      disabled,
    }),
    [disabled, handleChange, name, value]
  );

  return (
    <MultipleCheckboxContext.Provider value={contextValue}>
      <MultipleCheckboxWrapper>{children}</MultipleCheckboxWrapper>
    </MultipleCheckboxContext.Provider>
  );
}

function Item({
  value: itemValue,
  children,
  disabled: itemDisabled,
  onChange,
}: CheckboxItemProps) {
  const {disabled, value, handleChange, name} = useContext(MultipleCheckboxContext);

  return (
    <LabelContainer>
      <Label>
        <Checkbox
          name={name}
          checked={value.includes(itemValue)}
          disabled={disabled || itemDisabled}
          onChange={e => {
            handleChange(itemValue, e);
            onChange?.(e);
          }}
          value={value.toString()}
        />
        <CheckboxLabel>{children}</CheckboxLabel>
      </Label>
    </LabelContainer>
  );
}

MultipleCheckbox.Item = Item;

export default MultipleCheckbox;

const MultipleCheckboxWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const Label = styled('label')`
  display: inline-flex;
  align-items: center;
  font-weight: normal;
  white-space: nowrap;
  margin-right: 10px;
  margin-bottom: 10px;
  width: 20%;
`;

const CheckboxLabel = styled('span')`
  margin-left: ${space(1)};
`;

const LabelContainer = styled('div')`
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 50%;
  }
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 33.333%;
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    width: 25%;
  }
`;
