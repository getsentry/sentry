import * as React from 'react';

import {Input} from '@sentry/scraps/input';

import DropdownButton from 'sentry/components/dropdownButton';

import {SelectContext} from './control';

type TriggerEl = HTMLButtonElement | HTMLInputElement;

export type SelectTriggerProps = React.HTMLAttributes<TriggerEl> & {
  ref?: React.Ref<TriggerEl>;
};

export type ButtonTriggerProps = React.ComponentPropsWithoutRef<typeof DropdownButton> & {
  ref?: React.Ref<TriggerEl>;
};

type InputTriggerProps = React.ComponentPropsWithoutRef<typeof Input> & {
  ref?: React.Ref<TriggerEl>;
};

export const SelectTrigger = {
  Button(props: ButtonTriggerProps) {
    const {ref, ...componentProps} = props;
    const selectContext = React.useContext(SelectContext);
    const contextProps = {size: selectContext.size, isOpen: selectContext.overlayIsOpen};

    return (
      <DropdownButton
        {...contextProps}
        {...componentProps}
        ref={ref as React.Ref<HTMLButtonElement>}
      />
    );
  },

  Input(props: InputTriggerProps) {
    const {ref, ...componentProps} = props;

    const selectContext = React.useContext(SelectContext);
    const contextProps = {size: selectContext.size};

    return (
      <Input
        {...contextProps}
        {...componentProps}
        ref={ref as React.Ref<HTMLInputElement>}
      />
    );
  },
};
