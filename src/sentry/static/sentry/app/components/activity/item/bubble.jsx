import PropTypes from 'prop-types';
import styled from 'react-emotion';

/**
 * This creates a bordered box that has a left pointing arrow
 * on the left-side at the top.
 */
const ActivityBubble = styled('div')`
  flex: 1;
  background: ${p => p.background};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;

  &:before {
    display: block;
    content: '';
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-right: 7px solid ${p => p.theme.borderLight};
    position: absolute;
    left: -7px;
    top: 12px;
  }

  &:after {
    display: block;
    content: '';
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 6px solid ${p => p.background};
    position: absolute;
    left: -6px;
    top: 13px;
  }
`;

ActivityBubble.propTypes = {
  background: PropTypes.string,
};

ActivityBubble.defaultProps = {
  background: '#fff',
};

export default ActivityBubble;
