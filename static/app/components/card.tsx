import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';

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

const Card = styled(Panel)<Props>`
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
