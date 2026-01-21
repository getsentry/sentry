import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type Props = {
  /**
   * Do not add padding to left and right of the header
   */
  disablePadding?: boolean;
  /**
   * Usually we place controls at the right of a panel header, to make the
   * spacing between the edges correct we will want less padding on the right.
   * Use this when the panel has something such as buttons living there.
   */
  hasButtons?: boolean;
  /**
   * Use light text
   */
  lightText?: boolean;
};

const getPadding = ({disablePadding, hasButtons}: Props) => css`
  padding: ${hasButtons ? space(1) : space(2)} ${disablePadding ? 0 : space(2)};
`;

const PanelHeader = styled('div')<Props>`
  display: flex;
  align-items: center;
  justify-content: space-between;

  /* Do not apply text styles to overlay elements such as dropdowns */
  > *:not(:has([data-overlay], button, a[role='button']), button, a[role='button']),
  &:not(:has(> *)) {
    color: ${p =>
      p.lightText ? p.theme.tokens.content.secondary : p.theme.tokens.content.primary};
    font-size: ${p => p.theme.fontSize.sm};
    font-weight: ${p => p.theme.fontWeight.bold};
    text-transform: uppercase;
    line-height: 1;
  }

  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: calc(${p => p.theme.radius.md} + 1px)
    calc(${p => p.theme.radius.md} + 1px) 0 0;
  background: ${p => p.theme.tokens.background.secondary};
  position: relative;
  ${getPadding};
`;

export default PanelHeader;
