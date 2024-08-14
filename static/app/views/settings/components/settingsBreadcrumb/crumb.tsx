import styled from '@emotion/styled';

const Crumb = styled('div')`
  display: flex;
  gap: ${p => p.theme.space(0.75)};
  align-items: center;
  position: relative;
  color: ${p => p.theme.subText};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default Crumb;
