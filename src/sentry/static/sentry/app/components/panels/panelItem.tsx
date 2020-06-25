import {Flex} from 'reflexbox';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

const PanelItem = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};

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
