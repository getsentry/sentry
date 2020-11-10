import {css} from '@emotion/core';
import styled from '@emotion/styled';

type Props = {
  /**
   * Adds hover and focus states to the card
   */
  interactive?: boolean;
};

const hoverStyle = css`
  &:focus,
  &:hover {
    box-shadow: 0px 0px 0px 6px rgba(209, 202, 216, 0.2);
    position: relative;
    outline: none;
  }

  &:active {
    box-shadow: 0px 0px 0px 6px rgba(209, 202, 216, 0.5);
  }

  /* This is to ensure the graph is visually clickable */
  * {
    cursor: pointer;
  }
`;

const Card = styled('div')<Props>`
  background: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: stretch;
  flex-direction: column;
  transition: box-shadow 0.2s ease;
  text-align: left;
  padding: 0;

  ${p => p.interactive && 'cursor: pointer'};
  ${p => p.interactive && hoverStyle};
`;

export default Card;
