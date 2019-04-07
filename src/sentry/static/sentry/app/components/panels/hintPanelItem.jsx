import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

const HintPanelItem = styled(Flex)`
  border-top: 1px solid ${p => p.theme.borderLighter};
  border-left: 1px solid ${p => p.theme.borderLighter};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.whiteDark};
  font-size: ${p => p.theme.fontSizeMedium};

  h2 {
    font-size: ${p => p.theme.fontSizeLarge};
    margin-bottom: 0;
  }

  &:last-child {
    border: 0;
  }
`;

HintPanelItem.propTypes = {
  p: PropTypes.number,
};
HintPanelItem.defaultProps = {
  p: 2,
};

export default HintPanelItem;
