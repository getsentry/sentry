import * as React from 'react';
import type {DistributedOmit} from 'type-fest';

import DropdownButton, {type DropdownButtonProps} from 'sentry/components/dropdownButton';

import {SelectContext} from './control';

type TriggerEl =
  | HTMLButtonElement
  | (Omit<HTMLButtonElement, 'type'> & {
      type: 'only use SelectTrigger for the trigger prop!';
    });

export type SelectTriggerProps = React.HTMLAttributes<TriggerEl> & {
  ref?: React.Ref<TriggerEl>;
};

export type ButtonTriggerProps = DistributedOmit<DropdownButtonProps, 'ref'> & {
  ref?: React.Ref<TriggerEl>;
};

export const SelectTrigger = {
  Button({ref, ...props}: ButtonTriggerProps) {
    const selectContext = React.useContext(SelectContext);
    const contextProps = {
      size: selectContext.size,
      isOpen: selectContext.overlayIsOpen,
      disabled: selectContext.disabled,
    };

    return (
      <DropdownButton
        {...contextProps}
        {...props}
        ref={ref as React.Ref<HTMLButtonElement>}
      />
    );
  },
};
