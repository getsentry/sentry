import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

const PanelItem = styled(Flex, {shouldForwardProp: isPropValid})`
  border-bottom: 1px solid ${p => p.theme.borderLight};

  &:last-child {
    border: ${p => (p.forceBorder ? null : 0)};
  }
`;

PanelItem.propTypes = {
  p: PropTypes.number,
  forceBorder: PropTypes.bool,
};

PanelItem.defaultProps = {
  p: 2,
};

export default PanelItem;
