import styled from '@emotion/styled';

const SideBySide = styled('div')`
  display: flex;
  gap: ${p => p.theme.space(2)};
  flex-wrap: wrap;
  align-items: flex-start;
`;

export default SideBySide;
