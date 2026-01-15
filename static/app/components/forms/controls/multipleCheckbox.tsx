import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo} from 'react';
import styled from '@emotion/styled';
import noop from 'lodash/noop';

import {Flex} from '@sentry/scraps/layout';

import {Checkbox} from 'sentry/components/core/checkbox';
import {space} from 'sentry/styles/space';

type Props<T> = {
  children: ReactNode;
  name: string;
  value: T[];
  className?: string;
  disabled?: boolean;
  onChange?: (value: T[], event: React.ChangeEvent<HTMLInputElement>) => void;
};

type CheckboxItemProps<T> = {
  children: ReactNode;
  value: T;
  className?: string;
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
  className,
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
    <MultipleCheckboxContext value={contextValue}>
      <Flex wrap="wrap" className={className}>
        {children}
      </Flex>
    </MultipleCheckboxContext>
  );
}

function Item<T extends string | number>({
  value: itemValue,
  children,
  disabled: itemDisabled,
  onChange,
  className,
}: CheckboxItemProps<T>) {
  const {disabled, value, handleChange, name} = useContext<
    MultipleCheckboxContextValue<T>
  >(MultipleCheckboxContext);

  return (
    <LabelContainer className={className}>
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

const Label = styled('label')`
  display: inline-flex;
  align-items: center;
  font-weight: ${p => p.theme.fontWeight.normal};
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

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 50%;
  }
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    width: 33.333%;
  }
  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    width: 25%;
  }
`;
