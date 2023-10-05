import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {space} from 'sentry/styles/space';

export interface Props {
  display?: 'block' | 'flex';
}

const SizingWindow = styled(NegativeSpaceContainer)<Props>`
  border: 1px solid ${p => p.theme.yellow400};
  border-radius: ${p => p.theme.borderRadius};

  resize: both;
  padding: ${space(2)};

  ${p =>
    p.display === 'block'
      ? `
        display: block;
        overflow: auto;
      `
      : `
        display: flex;
        overflow: hidden;
      `}
`;

export default SizingWindow;
