import {createContext, useContext, useRef} from 'react';
import {
  useDisclosure,
  type AriaDisclosureProps,
  type DisclosureAria,
} from '@react-aria/disclosure';
import {useDisclosureState} from '@react-stately/disclosure';

import {Flex} from 'sentry/components/core/layout';

export interface DisclosureProps
  extends Omit<AriaDisclosureProps, 'isDisabled' | 'isExpanded'> {
  children: NonNullable<React.ReactNode>;
  disabled?: boolean;
  expanded?: boolean;
}

const DisclosureContext = createContext<DisclosureAria | null>(null);

function useDisclosureContext() {
  const context = useContext(DisclosureContext);
  if (!context) {
    throw new Error('useDisclosureContext must be used within a Disclosure component');
  }
  return context;
}

export function Disclosure({children, ...props}: DisclosureProps) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useDisclosureState({
    ...props,
    isExpanded: props.expanded,
  });

  const {buttonProps, panelProps} = useDisclosure(
    {...props, isDisabled: props.disabled, isExpanded: props.expanded},
    state,
    ref
  );

  return (
    <DisclosureContext.Provider value={{buttonProps, panelProps}}>
      <Flex ref={ref} direction="column">
        {children}
      </Flex>
    </DisclosureContext.Provider>
  );
}

interface DisclosureTitleProps {
  children: NonNullable<React.ReactNode>;
}

function Title({children}: DisclosureTitleProps) {
  const {buttonProps} = useDisclosureContext();
  return <button {...buttonProps}>{children}</button>;
}

interface DisclosureContentProps {
  children: NonNullable<React.ReactNode>;
}

function Content({children}: DisclosureContentProps) {
  const {panelProps} = useDisclosureContext();
  return <div {...panelProps}>{children}</div>;
}

Object.assign(Disclosure, {
  Title,
  Content,
});
