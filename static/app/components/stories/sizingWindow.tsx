import type {ComponentProps} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {space} from 'sentry/styles/space';

export interface StyleProps {
  display?: 'block' | 'flex';
}

const SizingWindow = styled(NegativeSpaceContainer)<StyleProps>`
  border: 1px solid ${p => p.theme.yellow400};
  border-radius: ${p => p.theme.borderRadius};

  resize: both;
  padding: ${space(2)};

  ${p =>
    p.display === 'block'
      ? css`
          display: block;
          overflow: auto;
        `
      : css`
          display: flex;
          overflow: hidden;
        `}
`;

export type SizingWindowProps = ComponentProps<typeof SizingWindow>;
export default SizingWindow;
