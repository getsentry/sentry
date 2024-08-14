import styled from '@emotion/styled';

const NegativeSpaceContainer = styled('div')`
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
`;

export default NegativeSpaceContainer;
