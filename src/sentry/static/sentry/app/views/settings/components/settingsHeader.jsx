import styled from 'react-emotion';
import space from 'app/styles/space';

const SettingsHeader = styled('div')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header};
  padding: ${space(3)} ${space(4)};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: #fff;
`;

export default SettingsHeader;
