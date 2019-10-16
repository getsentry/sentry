import styled from 'react-emotion';

const Header = styled('div')`
  position: relative;
  width: 100%;
  height: 60px;
  display: flex;

  border-bottom: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowLight};
  z-index: ${p => p.theme.zIndex.globalSelectionHeader};

  background: #fff;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

export default Header;
