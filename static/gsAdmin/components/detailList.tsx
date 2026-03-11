import styled from '@emotion/styled';

type Props = {
  maxLabelSize?: number;
};

const DetailList = styled('dl')<Props>`
  display: grid;
  gap: ${p => p.theme.space.md};
  grid-template-columns:
    minmax(${p => (p.maxLabelSize ? `${p.maxLabelSize}px` : '110px')}, max-content)
    1fr;
  margin-bottom: 0;
`;

export default DetailList;
