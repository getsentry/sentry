import styled from 'react-emotion';

const Panel = styled.div`
  background: #fff;
  border-radius: ${p => p.theme.radius};
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowLight};
  margin-bottom: 30px;
`;

export default Panel;
