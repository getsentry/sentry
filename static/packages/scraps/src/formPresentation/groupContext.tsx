import type * as React from 'react';
import {createContext, useContext} from 'react';

export interface GroupContextValue {
  'aria-invalid': boolean;
  disabled: boolean;
  isChecked: (value: string) => boolean;
  name: string;
  onChange: (value: string, checked: boolean) => void;
  'aria-describedby'?: string;
  onBlur?: () => void;
}

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: GroupContextValue;
}) {
  return <GroupContext value={value}>{children}</GroupContext>;
}

export function useGroupContext() {
  return useContext(GroupContext);
}

export function useGroupItemContext(value: string) {
  const context = useGroupContext();
  if (!context) {
    throw new Error('Group items must be used within a form field group');
  }
  const {isChecked, ...fieldProps} = context;
  return {...fieldProps, checked: isChecked(value)};
}
