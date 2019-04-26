import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

class ActivityBubble extends React.Component {
  static propTypes = {
    background: PropTypes.string,
  };

  static defaultProps = {
    background: '#fff',
  };

  render() {
    const {className, background, children} = this.props;

    return (
      <StyledActivityBubble background={background} className={className}>
        {children}
      </StyledActivityBubble>
    );
  }
}

const StyledActivityBubble = styled('div')`
  flex: 1;
  background: ${p => p.background};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: 3px;
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

export default ActivityBubble;
