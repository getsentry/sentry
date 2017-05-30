import styled from 'styled-components';

const NavHeader = styled.div`
  margin-bottom: 10px;
  text-transform: uppercase;
  font-size: 12px;
  color: ${props => props.theme.gray50};
  letter-spacing: 0.1px;
  font-weight: 600;
`;

export default NavHeader;
