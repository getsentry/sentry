import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import PanelItemGroup from './panelItemGroup';

const PanelItem = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};

  &:last-child {
    border: 0;
  }

  /* stylelint-disable-next-line */
  ${PanelItemGroup} & {
    border-bottom-color: ${p => p.theme.borderLight};

    /* stylelint-disable-next-line */
    &:last-child {
      border-bottom: none;
    }
  }
`;

PanelItem.propTypes = {
  p: PropTypes.number,
};
PanelItem.defaultProps = {
  p: 2,
};

export default PanelItem;
