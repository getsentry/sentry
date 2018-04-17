import styled from 'react-emotion';

const Crumb = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  font-size: 18px;
  color: ${p => p.theme.gray3};
  margin-right: 8px;
  padding: 6px 0;
  cursor: pointer;
  > span {
    transition: 0.1s all ease;
  }

  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

export default Crumb;
