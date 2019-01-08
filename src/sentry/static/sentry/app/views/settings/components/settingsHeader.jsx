import styled from 'react-emotion';

const SettingsHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header};
  padding: 20px 30px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: #fff;
`;

export default SettingsHeader;
