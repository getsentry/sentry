import PropTypes from 'prop-types';
import styled from '@emotion/styled';

type Props = {
  backgroundColor?: string;
  borderColor?: string;
};

/**
 * This creates a bordered box that has a left pointing arrow
 * on the left-side at the top.
 */
const ActivityBubble = styled('div')<Props>`
  flex: 1;
  background-color: ${p => p.backgroundColor};
  border: 1px solid ${p => p.borderColor || p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
  width: 100%; /* this is used in Incidents Details - a chart can cause overflow and won't resize properly */

  &:before {
    display: block;
    content: '';
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-right: 7px solid ${p => p.borderColor || p.theme.border};
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
    border-right: 6px solid ${p => p.backgroundColor || p.theme.background};
    position: absolute;
    left: -6px;
    top: 13px;
  }
`;

ActivityBubble.propTypes = {
  backgroundColor: PropTypes.string,
  borderColor: PropTypes.string,
};

export default ActivityBubble;
