import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo} from 'react';
import styled from '@emotion/styled';
import noop from 'lodash/noop';

import {Checkbox} from 'sentry/components/core/checkbox';
import {space} from 'sentry/styles/space';

type Props<T> = {
  children: ReactNode;
  name: string;
  value: T[];
  disabled?: boolean;
  onChange?: (value: T[], event: React.ChangeEvent<HTMLInputElement>) => void;
};

type CheckboxItemProps<T> = {
  children: ReactNode;
  value: T;
  disabled?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

type MultipleCheckboxContextValue<T> = {
  disabled: Props<T>['disabled'];
  handleChange: (itemValue: T, event: React.ChangeEvent<HTMLInputElement>) => void;
  name: string;
  value: Props<T>['value'];
};

const MultipleCheckboxContext = createContext<MultipleCheckboxContextValue<any>>({
  handleChange: noop,
  value: [],
  name: '',
  disabled: false,
});

function MultipleCheckbox<T extends string | number>({
  children,
  value,
  disabled,
  onChange,
  name,
}: Props<T>) {
  const handleChange = useCallback(
    (itemValue: T, e: React.ChangeEvent<HTMLInputElement>) => {
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

function Item<T extends string | number>({
  value: itemValue,
  children,
  disabled: itemDisabled,
  onChange,
}: CheckboxItemProps<T>) {
  const {disabled, value, handleChange, name} = useContext<
    MultipleCheckboxContextValue<T>
  >(MultipleCheckboxContext);

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
  font-weight: ${p => p.theme.fontWeightNormal};
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
