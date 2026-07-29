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
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconChevron} from 'sentry/icons';

interface DisclosureProps
  extends
    Omit<AriaDisclosureProps, 'isDisabled' | 'isExpanded'>,
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
      <Stack data-disclosure align="start" ref={ref} {...props}>
        {children}
      </Stack>
    </DisclosureContext.Provider>
  );
}

interface DisclosureTitleProps extends React.HTMLAttributes<HTMLButtonElement> {
  children?: NonNullable<React.ReactNode>;
  /**
   * A single-line summary of the collapsed content, shown after the title and
   * truncated to the space left over. Hidden once expanded, where the content
   * itself takes over. Sits outside the toggle button so it stays out of the
   * button's accessible name — it is a visual affordance, not a label.
   */
  preview?: React.ReactNode;
  trailingItems?: React.ReactNode;
}

function Title({children, preview, trailingItems, ...rest}: DisclosureTitleProps) {
  const {buttonProps, state, context} = useDisclosureContext();

  const {isDisabled, ...restProps} = buttonProps;
  const {pressProps} = usePress({...restProps});

  const showPreview = preview !== undefined && !state.isExpanded;

  return (
    <Flex
      justify="start"
      gap={context.size}
      align="center"
      width="100%"
      paddingRight="xs"
      radius="md"
    >
      <TitleButton
        icon={<IconChevron direction={state.isExpanded ? 'down' : 'right'} />}
        disabled={isDisabled}
        size={context.size}
        variant="transparent"
        $stretch={!showPreview}
        {...pressProps}
        {...rest}
      >
        {children}
      </TitleButton>
      {showPreview ? (
        // Shrinks before trailingItems do, so a long preview truncates instead
        // of squeezing them out.
        <Flex flex="1" minWidth={0} aria-hidden>
          <Text size={context.size} variant="muted" ellipsis>
            {preview}
          </Text>
        </Flex>
      ) : null}
      {trailingItems ?? null}
    </Flex>
  );
}

const TitleButton = styled(Button)<{$stretch: boolean}>`
  /* Without a preview the button owns the row; with one it hugs its label so
   * the preview takes the remaining space. */
  flex-grow: ${p => (p.$stretch ? 1 : 0)};
  flex-shrink: 0;
  justify-content: flex-start;
  padding-left: ${p => p.theme.space.xs};
`;

interface DisclosureContentProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

function Content({children, ...props}: DisclosureContentProps) {
  const {panelProps, panelRef, context} = useDisclosureContext();

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
