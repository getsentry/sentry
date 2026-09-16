import styled from '@emotion/styled';

/**
 * A button with all default browser styling removed.
 * Use when wrapping a Container or other visual primitive that
 * provides its own appearance but needs click/keyboard semantics.
 */
export const ScmCardButton = styled('button')`
  appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
  }
`;

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

export const ScmSelectableCardButton = styled(ScmCardButton)`
  /* Buttons center their contents vertically; these cards stretch to their
     tallest sibling and must stay top-aligned. */
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

  /* The edge the face lifts away from: a full-height layer whose bottom strip
     is all that shows once the face sits on top of it. It reads as the card's
     bottom border, so it takes the border color rather than a surface one. */
  &::before {
    border-radius: ${p => p.theme.radius.lg};
    /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
    background: ${p => p.theme.tokens.border.primary};
  }

  /* The face the contents ride on. */
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

    /* The tint rides on the contents, which sit above the face, so it
       composites over the face's own surface. */
    > * {
      background: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    }

    /* Only a checkbox reacts: clicking a selected radio does nothing, so
       promising a change on hover would be a lie. */
    &[role='checkbox']:hover:not(:disabled) > * {
      background: ${p =>
        p.theme.tokens.interactive.transparent.accent.selected.background.hover};
    }
  }

  /* A selected card is already pressed flat, and a disabled one cannot be
     pressed at all, so neither lifts. Excluding them here rather than relying on
     the rules below, whose selectors are weaker than this one. */
  &:hover:not(:disabled):not([aria-checked='true']) {
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

  &:disabled {
    &::after,
    > * {
      transform: translateY(0);
    }
  }
`;
