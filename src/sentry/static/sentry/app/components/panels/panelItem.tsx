import styled from '@emotion/styled';
import {Flex} from 'reflexbox'; // eslint-disable-line no-restricted-imports

const PanelItem = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  &:last-child {
    border: 0;
  }
`;

PanelItem.defaultProps = {
  p: 2,
};

export default PanelItem;
