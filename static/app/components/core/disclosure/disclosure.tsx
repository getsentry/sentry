import {createContext, useContext, useRef} from 'react';
import styled from '@emotion/styled';
import {
  useDisclosure,
  type AriaDisclosureProps,
  type DisclosureAria,
} from '@react-aria/disclosure';
import {usePress} from '@react-aria/interactions';
import {useDisclosureState, type DisclosureState} from '@react-stately/disclosure';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack, type StackProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';

interface DisclosureProps
  extends Omit<AriaDisclosureProps, 'isDisabled' | 'isExpanded'>, Omit<StackProps, 'as'> {
  children: NonNullable<React.ReactNode>;
  as?: 'section' | 'div';
  expanded?: boolean;
  ref?: React.Ref<HTMLDivElement | null>;
  size?: 'xs' | 'sm' | 'md';
  /**
   * Visual treatment of the disclosure's content panel:
   * - `default`: content is left-indented to align under the title.
   * - `outline`: content is a bordered, rounded card sitting below the title.
   */
  variant?: 'default' | 'outline';
}

type DisclosureContextValue = DisclosureAria & {
  context: {
    size: NonNullable<DisclosureProps['size']>;
    variant: NonNullable<DisclosureProps['variant']>;
  };
  panelRef: React.RefObject<HTMLDivElement | null>;
  state: DisclosureState;
};

const DisclosureContext = createContext<DisclosureContextValue | null>(null);

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
  variant = 'default',
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
    {...props, onExpandedChange, isExpanded: props.expanded},
    state,
    panelRef
  );

  return (
    <DisclosureContext.Provider
      value={{buttonProps, panelProps, panelRef, state, context: {size, variant}}}
    >
      <Stack data-disclosure align="start" ref={ref} {...props}>
        {children}
      </Stack>
    </DisclosureContext.Provider>
  );
}

interface DisclosureTitleProps extends React.HTMLAttributes<HTMLButtonElement> {
  children?: NonNullable<React.ReactNode>;
  /**
   * Content rendered before the toggle (e.g. an avatar or brand mark). When
   * provided, the chevron moves to sit after the title so the leading slot reads
   * as the row's first element.
   */
  leadingItems?: React.ReactNode;
  trailingItems?: React.ReactNode;
}

function Title({children, leadingItems, trailingItems, ...rest}: DisclosureTitleProps) {
  const {buttonProps, state, context} = useDisclosureContext();

  const {isDisabled, ...restProps} = buttonProps;
  const {pressProps} = usePress({...restProps});

  const chevron = <IconChevron direction={state.isExpanded ? 'down' : 'right'} />;

  // With a leading slot the chevron trails the title, so the leading content is
  // the visual anchor and the toggle still reads label-then-affordance.
  return (
    <TitleRow
      justify="start"
      gap={context.size}
      align="center"
      width="100%"
      paddingRight="xs"
      radius="md"
    >
      {leadingItems}
      <StretchedButton
        icon={leadingItems ? undefined : chevron}
        disabled={isDisabled}
        size={context.size}
        variant="transparent"
        {...pressProps}
        {...rest}
      >
        {leadingItems ? (
          <Flex align="center" gap="xs">
            {children}
            {chevron}
          </Flex>
        ) : (
          children
        )}
      </StretchedButton>
      {trailingItems}
    </TitleRow>
  );
}

// The row owns the hover background so it spans the full title — behind the
// leading and trailing items — rather than only the toggle button between them.
// The press (:active) state deliberately stays on the button (below), so that
// pressing a leading or trailing item does not bubble an active background onto
// the whole row.
const TitleRow = styled(Flex)`
  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
`;

const StretchedButton = styled(Button)`
  flex-grow: 1;
  justify-content: flex-start;
  padding-left: ${p => p.theme.space.xs};

  /* The TitleRow provides the full-width hover background; suppress the button's
   * own hover so the two don't stack into a darker patch behind the label. Keep
   * the press state on the button so it reflects the toggle specifically. */
  &&:hover {
    background-color: transparent;
  }

  &&:active {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

interface DisclosureContentProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

const OUTLINE_PADDING = {xs: 'sm', sm: 'md', md: 'lg'} as const;
const OUTLINE_RADIUS = {xs: 'md', sm: 'lg', md: 'xl'} as const;

function Content({children, ...props}: DisclosureContentProps) {
  const {panelProps, panelRef, context} = useDisclosureContext();

  if (context.variant === 'outline') {
    return (
      <Container
        ref={panelRef}
        {...panelProps}
        border="primary"
        radius={OUTLINE_RADIUS[context.size]}
        padding={OUTLINE_PADDING[context.size]}
        width="100%"
        {...props}
      >
        {children}
      </Container>
    );
  }

  return (
    <AlignedContainer
      ref={panelRef}
      {...panelProps}
      padding={context.size}
      size={context.size}
      width="100%"
      {...props}
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
