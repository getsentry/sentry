import PropTypes from 'prop-types';
import styled from '@emotion/styled';

type Props = {
  /**
   * Centers content via `justify-content`
   */
  center?: boolean;
  /**
   * Changes flex direction to be column
   */
  vertical?: boolean;
  /**
   * Applies "overflow: hidden" to container so that children can be truncated
   */
  truncate?: boolean;
};

const FlowLayout = styled('div')<Props>`
  display: flex;
  flex: 1;
  align-items: center;
  flex-direction: ${p => (p.vertical ? 'column' : null)};
  justify-content: ${p => (p.center ? 'center' : null)};
  overflow: ${p => (p.truncate ? 'hidden' : null)};
`;

FlowLayout.propTypes = {
  center: PropTypes.bool,
  vertical: PropTypes.bool,
  truncate: PropTypes.bool,
};

FlowLayout.defaultProps = {
  truncate: true,
};

export default FlowLayout;
