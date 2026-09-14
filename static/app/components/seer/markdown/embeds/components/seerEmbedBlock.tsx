import {useRef, type ComponentType, type ReactNode} from 'react';
import styled from '@emotion/styled';
import {useDisclosure} from '@react-aria/disclosure';
import {usePress} from '@react-aria/interactions';
import {useDisclosureState} from '@react-stately/disclosure';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack, type StackProps} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconChevron} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

interface SeerEmbedBlockProps {
  /** The preview this card frames, rendered inside the collapsible panel. */
  children: ReactNode;
  /** Where the top-right link points — the resource's own page in Sentry. */
  href: string;
  /** Icon rendered before the top-right link's label. */
  icon: ComponentType<SVGIconProps>;
  /**
   * The top-right link's label: a fixed call to action naming the destination
   * ("View Dashboard"), not the resource's name — the name is the `title`.
   */
  linkLabel: string;
  testId: string;
  /** The card's heading, top left. Plain text, not a link. */
  title: ReactNode;
  /** Sits between the title and the link, for tags describing the contents. */
  badge?: ReactNode;
  /**
   * Whether the panel starts open. An embed whose preview is tall or slow to
   * load can ship collapsed.
   */
  defaultExpanded?: boolean;
  /** Spacing between the panel's own children. */
  gap?: StackProps['gap'];
}

/**
 * The chrome every Seer block embed shares: a bordered card whose header band
 * carries the resource's name and a collapse toggle on the left, and a link out
 * to the resource on the right.
 *
 * Splitting the name from the link is the point of the layout. The name says
 * what the block is about and doubles as the toggle's label, so the whole left
 * half of the header collapses the card; navigating away is a separate,
 * explicitly labelled target on the right that a reader can no longer trigger
 * by aiming at the title.
 *
 * The expand/collapse behavior comes from the same `@react-aria/disclosure`
 * hooks the core `Disclosure` is built on — `aria-expanded`/`aria-controls`
 * wiring and `hidden="until-found"` on the panel, so browser find-in-page still
 * reaches a collapsed preview. `Disclosure` itself is not used here because it
 * owns its row layout: a leading chevron and content indented to sit under the
 * title, neither of which this card's header band can express.
 */
export function SeerEmbedBlock({
  badge,
  children,
  defaultExpanded = true,
  gap = 'md',
  href,
  icon,
  linkLabel,
  testId,
  title,
}: SeerEmbedBlockProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const state = useDisclosureState({defaultExpanded});
  const {buttonProps, panelProps} = useDisclosure({}, state, panelRef);
  // `buttonProps` speaks react-aria's `onPress`; `usePress` turns that into the
  // DOM handlers a plain <button> understands. The two aria attributes are
  // forwarded by hand because `usePress` returns only press props.
  const {isDisabled, ...toggleProps} = buttonProps;
  const {pressProps} = usePress(toggleProps);

  return (
    <Container
      background="primary"
      border="primary"
      containerType="inline-size"
      data-test-id={testId}
      overflow="hidden"
      radius="md"
      width="100%"
    >
      <HeaderRow
        align="center"
        background="secondary"
        gap="md"
        justify="between"
        padding="sm md"
        wrap="wrap"
      >
        <ToggleButton
          {...pressProps}
          aria-controls={toggleProps['aria-controls']}
          aria-expanded={toggleProps['aria-expanded']}
          disabled={isDisabled}
          size="zero"
          variant="transparent"
        >
          <Flex align="center" gap="xs" minWidth="0">
            <Heading as="h3" ellipsis size="sm">
              {title}
            </Heading>
            <IconChevron direction={state.isExpanded ? 'up' : 'down'} size="xs" />
          </Flex>
        </ToggleButton>
        <Flex align="center" gap="md" wrap="wrap">
          {badge}
          <ResourceLink icon={icon} href={href} title={linkLabel} />
        </Flex>
      </HeaderRow>
      {/* The panel's padding sits on an inner element, not on the element
          `panelProps` hides. `hidden="until-found"` hides contents through
          `content-visibility`, which leaves the hidden element's own padding box
          behind -- padding out here would strand an empty strip under the header
          of every collapsed card. */}
      <Container {...panelProps} ref={panelRef}>
        <Stack gap={gap} padding="lg">
          {children}
        </Stack>
      </Container>
    </Container>
  );
}

// The row, not the button, owns the hover state so the whole header lights up
// as one collapse target rather than a patch behind the title alone.
const HeaderRow = styled(Flex)`
  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
`;

/**
 * The toggle takes the header's free space, so the click target is the whole
 * left half of the row rather than just the words; the link on the right keeps
 * its own, narrower target. `size="zero"` strips the button's padding so the
 * title lines up with the panel's content below it.
 */
const ToggleButton = styled(Button)`
  flex: 1 1 auto;
  justify-content: flex-start;
  min-width: 0;

  /* HeaderRow owns the row's hover background; suppress the button's own so it
   * never paints a second, nested patch on top. */
  &&:hover,
  &&:active {
    background-color: transparent;
  }
`;
