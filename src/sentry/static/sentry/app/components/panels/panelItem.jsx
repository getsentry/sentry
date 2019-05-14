import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

const getBorders = p => `
  border-bottom:  1px solid ${p.theme.borderLight};

  &:last-child {
    border-bottom: 0;
  }
`;

const PanelItem = styled(Flex, {shouldForwardProp: isPropValid})`
  ${p => !p.borderless && getBorders(p)};
`;

PanelItem.propTypes = {
  p: PropTypes.number,
  borderless: PropTypes.bool,
};

PanelItem.defaultProps = {
  p: 2,
};

export default PanelItem;
