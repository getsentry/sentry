import styled from 'react-emotion';

const Divider = styled('div')`
  height: 0;
  text-indent: -9999em;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  margin: 5px 0;
`;
export default Divider;
