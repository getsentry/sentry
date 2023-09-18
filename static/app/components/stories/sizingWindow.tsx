import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const SizingWindow = styled('div')`
  width: 100%;
  display: flex;
  flex-grow: 1;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;

  background-color: ${p => p.theme.backgroundSecondary};
  background-image: repeating-linear-gradient(
      -145deg,
      transparent,
      transparent 8px,
      ${p => p.theme.backgroundSecondary} 8px,
      ${p => p.theme.backgroundSecondary} 11px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 15px,
      ${p => p.theme.gray100} 15px,
      ${p => p.theme.gray100} 16px
    );

  border: 1px solid ${p => p.theme.yellow400};
  border-radius: ${p => p.theme.borderRadius};

  resize: both;
  padding: ${space(2)};
`;

export default SizingWindow;
