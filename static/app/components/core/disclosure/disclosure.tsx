import {createContext, useContext, useRef} from 'react';
import styled from '@emotion/styled';
import {
  useDisclosure,
  type AriaDisclosureProps,
  type DisclosureAria,
} from '@react-aria/disclosure';
import {usePress} from '@react-aria/interactions';
import {useDisclosureState, type DisclosureState} from '@react-stately/disclosure';

import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconChevron} from 'sentry/icons';

export interface DisclosureProps
  extends Omit<AriaDisclosureProps, 'isDisabled' | 'isExpanded'> {
  children: NonNullable<React.ReactNode>;
  disabled?: boolean;
  expanded?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

const DisclosureContext = createContext<
  | (DisclosureAria & {
      context: {size: NonNullable<DisclosureProps['size']>};
      panelRef: React.RefObject<HTMLDivElement | null>;
      state: DisclosureState;
    })
  | null
>(null);

function useDisclosureContext() {
  const context = useContext(DisclosureContext);
  if (!context) {
    throw new Error('useDisclosureContext must be used within a Disclosure component');
  }
  return context;
}

function DisclosureComponent({children, size = 'md', ...props}: DisclosureProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const state = useDisclosureState({
    ...props,
    isExpanded: props.expanded,
  });

  const {buttonProps, panelProps} = useDisclosure(
    {...props, isDisabled: props.disabled, isExpanded: props.expanded},
    state,
    panelRef
  );

  return (
    <DisclosureContext.Provider
      value={{buttonProps, panelProps, panelRef, state, context: {size}}}
    >
      <Flex direction="column" align="start">
        {children}
      </Flex>
    </DisclosureContext.Provider>
  );
}

interface DisclosureTitleProps {
  children?: NonNullable<React.ReactNode>;
  trailingItems?: React.ReactNode;
}

function Title({children, trailingItems}: DisclosureTitleProps) {
  const {buttonProps, state, context} = useDisclosureContext();

  const {isDisabled, ...rest} = buttonProps;
  const {pressProps} = usePress({...rest});

  return (
    <Flex justify="start" gap={context.size} align="center">
      <StretchedButton
        icon={<IconChevron direction={state.isExpanded ? 'down' : 'right'} />}
        disabled={isDisabled}
        size={context.size}
        priority="transparent"
        {...pressProps}
      >
        {children}
      </StretchedButton>
      {trailingItems ?? null}
    </Flex>
  );
}

const StretchedButton = styled(Button)`
  flex-grow: 1;
  justify-content: flex-start;
`;

interface DisclosureContentProps {
  children: NonNullable<React.ReactNode>;
}

function Content({children}: DisclosureContentProps) {
  const {panelProps, panelRef, context} = useDisclosureContext();

  return (
    <AlignedContainer
      ref={panelRef}
      {...panelProps}
      padding={context.size}
      size={context.size}
    >
      <Text as="div" size={context.size}>
        {children}
      </Text>
    </AlignedContainer>
  );
}

const AlignedContainer = styled(Container)<{size: NonNullable<DisclosureProps['size']>}>`
  padding-left: ${p => (p.size === 'xs' ? '26px' : p.size === 'sm' ? '34px' : '38px')};
`;

export const Disclosure = Object.assign(DisclosureComponent, {
  Title,
  Content,
});
