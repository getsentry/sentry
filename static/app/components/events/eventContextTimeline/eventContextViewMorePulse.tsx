import {css, keyframes} from '@emotion/react';
import styled from '@emotion/styled';

const ringPulse = (color: string) => keyframes`
  0% {
    box-shadow: 0 0 0 0 ${color};
  }
  100% {
    box-shadow: 0 0 0 8px transparent;
  }
`;

/**
 * Wraps a section's "View more" button and briefly draws a pulsing ring around it when a
 * timeline marker addresses a row hidden behind it. Set `active` when the focused row is
 * hidden, and give the element a React `key` that changes per click (a focus nonce) so
 * the one-shot animation replays on every repeat click, not just the first.
 */
export const ViewMorePulse = styled('div')<{active: boolean}>`
  /* Hug the button rather than stretching to the parent flex column's width, so the
   * ring traces the button outline instead of the whole row. */
  display: inline-flex;
  align-self: flex-start;
  width: fit-content;
  border-radius: 6px;
  ${p =>
    p.active
      ? css`
          @media (prefers-reduced-motion: no-preference) {
            animation: ${ringPulse(p.theme.tokens.graphics.accent.vibrant)} 1.2s ease-out
              2;
          }
        `
      : ''}
`;
