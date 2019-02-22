import PropTypes from 'prop-types';
import styled from 'react-emotion';

const FlowLayout = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  flex-direction: ${p => (p.vertical ? 'column' : null)};
  justify-content: ${p => (p.center ? 'center' : null)};
  overflow: ${p => (p.truncate ? 'hidden' : null)};
`;

FlowLayout.propTypes = {
  /**
   * Centers content via `justify-content`
   */
  center: PropTypes.bool,
  /**
   * Changes flex direction to be column
   */
  vertical: PropTypes.bool,
  /**
   * Applies "overflow: hidden" to container so that children can be truncated
   */
  truncate: PropTypes.bool,
};

FlowLayout.defaultProps = {
  truncate: true,
};

export default FlowLayout;
