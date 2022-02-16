import {css} from '@emotion/react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';

/**
 * Using Parameters<typeof FieldWrapper> in the Field component somehow
 * causes an infinite recursive depth so exporting the props is best workaround
 */
type Props = {
  /**
   * When false adds padding to the right of the element to ensure visual
   * consistency with other fields that aren't using flexible control states.
   */
  hasControlState?: boolean;
  /**
   * Is "highlighted", i.e. after a search
   */
  highlighted?: boolean;
  /**
   * Display the field control container in "inline" fashion. The label and
   * description will be aligned to the left, while the control itself will be
   * aligned to the right.
   */
  inline?: boolean;
  /**
   * When stacking forms the bottom border is hidden and padding is adjusted
   * for form elements to be stacked on each other.
   */
  stacked?: boolean;
};

const inlineStyle = (p: Props) =>
  p.inline
    ? css`
        align-items: center;
      `
    : css`
        flex-direction: column;
        align-items: stretch;
      `;

const getPadding = (p: Props) =>
  p.stacked && !p.inline
    ? css`
        padding: 0 ${p.hasControlState ? 0 : space(2)} ${space(2)} 0;
      `
    : css`
        padding: ${space(2)} ${p.hasControlState ? 0 : space(2)} ${space(2)} ${space(2)};
      `;

const FieldWrapper = styled('div')<Props>`
  ${getPadding}
  ${inlineStyle}
  display: flex;
  transition: background 0.15s;

  ${p =>
    !p.stacked &&
    css`
      border-bottom: 1px solid ${p.theme.innerBorder};
    `}

  ${p =>
    p.highlighted &&
    css`
      position: relative;

      &:after {
        content: '';
        display: block;
        position: absolute;
        top: -1px;
        left: -1px;
        right: -1px;
        bottom: -1px;
        border: 1px solid ${p.theme.purple300};
        pointer-events: none;
      }
    `}


  /* Better padding with form inside of a modal */
  ${p =>
    !p.hasControlState &&
    css`
      [role='document'] & {
        padding-right: 0;
      }
    `}

  &:last-child {
    border-bottom: none;
    ${p => (p.stacked ? 'padding-bottom: 0' : '')};
  }
`;

export default FieldWrapper;
