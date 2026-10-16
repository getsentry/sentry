import * as React from 'react';
import type {DistributedOmit, SetRequired} from 'type-fest';

import {ControlContext} from './compactSelect/controlContext';
import {DropdownButton, type DropdownButtonProps} from './dropdownMenu/dropdownButton';

type TriggerEl =
  | HTMLButtonElement
  | (Omit<HTMLButtonElement, 'ELEMENT_NODE'> & {
      ELEMENT_NODE: 'only use `OverlayTrigger.Button` or `OverlayTrigger.IconButton` for the trigger prop!';
    });

export type TriggerProps = Omit<React.HTMLAttributes<TriggerEl>, 'children'> & {
  children: NonNullable<React.ReactNode>;
  ref?: React.Ref<TriggerEl>;
};

export type OverlayTriggerButtonProps = DistributedOmit<
  DropdownButtonProps,
  'ref' | 'children' | 'onClick'
> & {
  children: NonNullable<React.ReactNode>;
  ref?: React.Ref<TriggerEl> | React.Ref<HTMLButtonElement>;
};

export type OverlayTriggerIconButtonProps = SetRequired<
  DistributedOmit<DropdownButtonProps, 'ref' | 'showChevron' | 'onClick'>,
  'aria-label' | 'icon'
> & {
  ref?: React.Ref<TriggerEl> | React.Ref<HTMLButtonElement>;
};

const useContextProps = () => {
  const selectContext = React.useContext(ControlContext);
  return {
    size: selectContext.size,
    isOpen: selectContext.overlayIsOpen,
    disabled: selectContext.disabled,
  };
};

export const OverlayTrigger = {
  Button({ref, ...props}: OverlayTriggerButtonProps) {
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
  IconButton({ref, children: _, ...props}: OverlayTriggerIconButtonProps) {
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
