import styled from 'react-emotion';

const Header = styled('div')`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowLight};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  height: 60px;
  z-index: ${p => p.theme.zIndex.globalSelectionHeader};
  position: relative;
  width: 100%;
  background: #fff;
`;

export default Header;
