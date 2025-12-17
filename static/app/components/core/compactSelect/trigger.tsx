import * as React from 'react';
import type {DistributedOmit, SetRequired} from 'type-fest';

import DropdownButton, {type DropdownButtonProps} from 'sentry/components/dropdownButton';

import {SelectContext} from './control';

type TriggerEl =
  | HTMLButtonElement
  | (Omit<HTMLButtonElement, 'type'> & {
      type: 'only use SelectTrigger for the trigger prop!';
    });

export type SelectTriggerProps = SetRequired<
  React.HTMLAttributes<TriggerEl>,
  'children'
> & {
  ref?: React.Ref<TriggerEl>;
};

export type ButtonTriggerProps = SetRequired<
  DistributedOmit<DropdownButtonProps, 'ref'>,
  'children'
> & {
  ref?: React.Ref<TriggerEl>;
};

type IconButtonTriggerProps = SetRequired<
  DistributedOmit<DropdownButtonProps, 'ref' | 'showChevron'>,
  'aria-label' | 'icon'
> & {
  ref?: React.Ref<TriggerEl>;
};

const useContextProps = () => {
  const selectContext = React.useContext(SelectContext);
  return {
    size: selectContext.size,
    isOpen: selectContext.overlayIsOpen,
    disabled: selectContext.disabled,
  };
};

export const SelectTrigger = {
  Button({ref, ...props}: ButtonTriggerProps) {
    return (
      <DropdownButton
        {...useContextProps()}
        {...props}
        ref={ref as React.Ref<HTMLButtonElement>}
      />
    );
  },

  // omit children prop to prevent usage of children in IconButton
  // we still need children on type level to allow ergonomic object spreading of triggerProps
  IconButton({ref, children: _, ...props}: IconButtonTriggerProps) {
    return (
      <DropdownButton
        {...useContextProps()}
        {...props}
        showChevron={false}
        ref={ref as React.Ref<HTMLButtonElement>}
      />
    );
  },
};
