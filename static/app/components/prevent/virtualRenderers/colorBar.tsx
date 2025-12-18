import styled from '@emotion/styled';

interface ColorBarProps {
  isHighlighted: boolean;
}

export function ColorBar({isHighlighted}: ColorBarProps) {
  return (
    <ColorBarWrapper>
      <StyledColorBar isHighlighted={isHighlighted} />
    </ColorBarWrapper>
  );
}

const StyledColorBar = styled('div')<{isHighlighted: boolean}>`
  pointer-events: none;
  position: absolute;
  left: -72px;
  height: 100%;
  width: calc(100% + 72px);

  background-color: ${p => (p.isHighlighted ? p.theme.colors.blue200 : 'inherit')};
`;

const ColorBarWrapper = styled('div')`
  z-index: -1;
  grid-column-start: 1;
  grid-row-start: 1;
`;
