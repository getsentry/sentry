import styled from '@emotion/styled';

interface Props {
  maxLabelSize?: number;
}

export const DetailList = styled('dl')<Props>`
  display: grid;
  gap: ${p => p.theme.space.md};
  grid-template-columns:
    minmax(${p => (p.maxLabelSize ? `${p.maxLabelSize}px` : '110px')}, max-content)
    1fr;
  margin-bottom: 0;
`;
