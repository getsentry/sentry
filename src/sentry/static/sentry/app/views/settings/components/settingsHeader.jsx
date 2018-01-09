import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

const SettingsHeader = styled(Flex)`
  align-items: center;
  position: sticky;
  top: 0;
  height: 105px;
  width: 1010px;
  z-index: ${p => p.theme.zIndex.header};
  &:before {
    position: absolute;
    display: block;
    content: '';
    top: 0;
    right: 0;
    left: 0;
    bottom: 5px;
    background-image: linear-gradient(
      to bottom,
      #fcfcfc 0%,
      #fcfcfc 80%,
      rgba(255, 255, 255, 0.2) 100%
    );
  }
`;

export default SettingsHeader;
