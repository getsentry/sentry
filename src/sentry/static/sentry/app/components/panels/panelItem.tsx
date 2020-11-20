import styled from '@emotion/styled';
import PropTypes from 'prop-types';
import {Flex} from 'reflexbox'; // eslint-disable-line no-restricted-imports

const PanelItem = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  &:last-child {
    border: 0;
  }
`;

PanelItem.propTypes = {
  p: PropTypes.number,
};
PanelItem.defaultProps = {
  p: 2,
};

export default PanelItem;
