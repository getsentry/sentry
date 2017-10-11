import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

const SettingsHeader = styled(Flex)`
  align-items: center;
  position: sticky;
  top: 0;
  height: 105px;
  width: 928px;
  background-image: linear-gradient(
    to bottom,
    #fcfcfc 0%,
    #fcfcfc 80%,
    rgba(255, 255, 255, 0.2) 100%
  );
  z-index: 1000000;
`;

export default SettingsHeader;
