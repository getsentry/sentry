import type {CSSProperties} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {space} from 'sentry/styles/space';
import type {Space} from 'sentry/utils/theme/theme';

interface FlexProps {
  align?: CSSProperties['alignItems'];
  direction?: CSSProperties['flexDirection'];
  flex?: CSSProperties['flex'];
  gap?: Space | ReturnType<typeof space>;
  /**
   * Determines whether the flex container should be displayed as an inline-flex.
   */
  inline?: boolean;
  justify?: CSSProperties['justifyContent'];
  wrap?: CSSProperties['flexWrap'];
}

export const Flex = styled('div', {
  shouldForwardProp: prop =>
    !['align', 'direction', 'flex', 'gap', 'inline', 'justify', 'wrap'].includes(prop),
})<FlexProps>`
  display: ${p => (p.inline ? 'inline-flex' : 'flex')};
  flex-direction: ${p => p.direction};
  justify-content: ${p => p.justify};
  align-items: ${p => p.align};
  ${p =>
    p.gap &&
    css`
      gap: ${p.gap in p.theme.space ? p.theme.space[p.gap as Space] : p.gap};
    `};
  flex-wrap: ${p => p.wrap};
  flex: ${p => p.flex};
`;
