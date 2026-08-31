import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo} from 'react';
import styled from '@emotion/styled';
import noop from 'lodash/noop';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex} from '@sentry/scraps/layout';

type Props<T> = {
  children: ReactNode;
  name: string;
  value: T[];
  className?: string;
  onChange?: (value: T[], event: React.ChangeEvent<HTMLInputElement>) => void;
};

type CheckboxItemProps<T> = {
  children: ReactNode;
  value: T;
  className?: string;
  disabled?: boolean;
};

type MultipleCheckboxContextValue<T> = {
  handleChange: (itemValue: T, event: React.ChangeEvent<HTMLInputElement>) => void;
  name: string;
  value: Props<T>['value'];
};

const MultipleCheckboxContext = createContext<MultipleCheckboxContextValue<any>>({
  handleChange: noop,
  value: [],
  name: '',
});

export function MultipleCheckbox<T extends string | number>({
  children,
  value,
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
    }),
    [handleChange, name, value]
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
  className,
}: CheckboxItemProps<T>) {
  const {value, handleChange, name} = useContext<MultipleCheckboxContextValue<T>>(
    MultipleCheckboxContext
  );

  return (
    <Container
      className={className}
      width={{zero: '100%', xl: '50%', '3xl': '33.333%', '4xl': '25%'}}
    >
      <Label>
        <Checkbox
          name={name}
          checked={value.includes(itemValue)}
          disabled={itemDisabled}
          onChange={e => {
            handleChange(itemValue, e);
          }}
          value={value.toString()}
        />
        <CheckboxLabel>{children}</CheckboxLabel>
      </Label>
    </Container>
  );
}

MultipleCheckbox.Item = Item;

const Label = styled('label')`
  display: inline-flex;
  align-items: center;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  white-space: nowrap;
  margin-right: 10px;
  margin-bottom: 10px;
  width: 20%;
`;

const CheckboxLabel = styled('span')`
  margin-left: ${p => p.theme.space.md};
`;
