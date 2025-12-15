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

interface DisclosureProps
  extends Omit<AriaDisclosureProps, 'isDisabled' | 'isExpanded'>,
    React.HTMLAttributes<HTMLDivElement> {
  children: NonNullable<React.ReactNode>;
  as?: 'section' | 'div';
  disabled?: boolean;
  expanded?: boolean;
  ref?: React.Ref<HTMLDivElement | null>;
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

function DisclosureComponent({
  children,
  size = 'md',
  ref,
  onExpandedChange,
  ...props
}: DisclosureProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const state = useDisclosureState({
    ...props,
    isExpanded: props.expanded,
    onExpandedChange,
  });

  const {buttonProps, panelProps} = useDisclosure(
    {...props, onExpandedChange, isDisabled: props.disabled, isExpanded: props.expanded},
    state,
    panelRef
  );

  return (
    <DisclosureContext.Provider
      value={{buttonProps, panelProps, panelRef, state, context: {size}}}
    >
      <Flex data-disclosure direction="column" align="start" ref={ref} {...props}>
        {children}
      </Flex>
    </DisclosureContext.Provider>
  );
}

interface DisclosureTitleProps extends React.HTMLAttributes<HTMLButtonElement> {
  children?: NonNullable<React.ReactNode>;
  trailingItems?: React.ReactNode;
}

function Title({children, trailingItems, ...rest}: DisclosureTitleProps) {
  const {buttonProps, state, context} = useDisclosureContext();

  const {isDisabled, ...restProps} = buttonProps;
  const {pressProps} = usePress({...restProps});

  return (
    <Flex
      justify="start"
      gap={context.size}
      align="center"
      width="100%"
      paddingRight="xs"
      radius="md"
    >
      <StretchedButton
        icon={<IconChevron direction={state.isExpanded ? 'down' : 'right'} />}
        disabled={isDisabled}
        size={context.size}
        priority="transparent"
        {...pressProps}
        {...rest}
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
  padding-left: ${p => p.theme.space.xs};
`;

interface DisclosureContentProps {
  children: React.ReactNode;
}

function Content({children}: DisclosureContentProps) {
  const {panelProps, panelRef, context} = useDisclosureContext();

  return (
    <AlignedContainer
      ref={panelRef}
      {...panelProps}
      padding={context.size}
      size={context.size}
      width="100%"
    >
      <Text as="div" size={context.size}>
        {children}
      </Text>
    </AlignedContainer>
  );
}

const AlignedContainer = styled(Container)<{size: NonNullable<DisclosureProps['size']>}>`
  padding-left: ${p => (p.size === 'xs' ? '22px' : p.size === 'sm' ? '26px' : '26px')};
`;

export const Disclosure = Object.assign(DisclosureComponent, {
  Title,
  Content,
});
