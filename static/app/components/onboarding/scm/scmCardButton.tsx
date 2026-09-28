import styled from '@emotion/styled';
import {motion} from 'framer-motion';

const CardButton = styled('button')`
  appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;

  &[aria-disabled='true'] {
    cursor: not-allowed;
  }
`;

interface ScmCardButtonProps extends Omit<
  React.ComponentProps<typeof CardButton>,
  'disabled'
> {
  /**
   * Rendered as aria-disabled rather than disabled, so the card stays
   * focusable and a tooltip that says why it is disabled opens on focus.
   */
  disabled?: boolean;
}

/**
 * A button with all default browser styling removed.
 * Use when wrapping a Container or other visual primitive that
 * provides its own appearance but needs click/keyboard semantics.
 *
 * Defaults to `type="button"` so a card inside a form (see
 * ScmCreateProject) neither submits it on click nor becomes the form's
 * default button for Enter in a text field.
 */
export function ScmCardButton({
  type = 'button',
  disabled,
  onClick,
  ...props
}: ScmCardButtonProps) {
  return (
    <CardButton
      type={type}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      {...props}
    />
  );
}

/**
 * A selectable card that behaves like our buttons: the face rides above a
 * fixed edge, lifts a little on hover, and presses flat when it is active or
 * selected. Mirrors the checkout option cards. Drive the selected state with
 * `aria-checked` on the button; the card inside should draw only its padding
 * and contents, since the pseudo-elements paint the surface and border.
 */
// How far the face sits above its edge at rest, and while hovered.
const CARD_LIFT = '1px';
const CARD_HOVER_LIFT = '2px';

const SelectableCard = styled(ScmCardButton)`
  /* Buttons center their contents; these stretch and must stay top-aligned. */
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  color: ${p => p.theme.tokens.content.primary};

  &::before,
  &::after {
    content: '';
    display: block;
    position: absolute;
    inset: 0;
  }

  /* The edge under the face. It reads as the card's bottom border, so it takes
     the border color rather than a surface one. */
  &::before {
    border-radius: ${p => p.theme.radius.lg};
    /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
    background: ${p => p.theme.tokens.border.primary};
  }

  &::after {
    border-radius: ${p => p.theme.radius.lg};
    background: ${p => p.theme.tokens.background.primary};
    border: 1px solid ${p => p.theme.tokens.border.primary};
    transform: translateY(-${CARD_LIFT});
    transition: transform 0.06s ease-in;
  }

  > * {
    position: relative;
    z-index: 1;
    height: 100%;
    transform: translateY(-${CARD_LIFT});
    transition: transform 0.06s ease-in;
  }

  &[aria-checked='true'] {
    &::before {
      background: ${p => p.theme.tokens.graphics.accent.vibrant};
    }

    &::after {
      border-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    }

    > * {
      background: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    }

    /* Only a checkbox reacts: clicking a selected radio does nothing, so
       promising a change on hover would be a lie. */
    &[role='checkbox']:hover:not([aria-disabled='true']) > * {
      background: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.hover};
    }
  }

  /* Excluded here rather than by the rules below, whose selectors are weaker.
     That includes :active, or a mouse press would keep the hover lift and never
     press the card flat. */
  &:hover:not([aria-disabled='true']):not([aria-checked='true']):not(:active) {
    &::after,
    > * {
      transform: translateY(-${CARD_HOVER_LIFT});
    }
  }

  &:active,
  &[aria-checked='true'] {
    &::after,
    > * {
      transform: translateY(0);
    }
  }

  &[aria-disabled='true'] {
    &::after,
    > * {
      transform: translateY(0);
    }
  }
`;

/** Motion-aware so a grid of these can stagger its items in. */
export const ScmSelectableCardButton = motion.create(SelectableCard);
