import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import styled, {css, keyframes} from 'react-emotion';

import {fadeIn} from 'app/styles/animations';
import space from 'app/styles/space';

const DEFAULT_POSITION = {x: 'middle', y: 'top', offset: 0};

class Hovercard extends React.Component {
  static propTypes = {
    displayTimeout: PropTypes.number,
    className: PropTypes.string,
    containerClassName: PropTypes.string,
    header: PropTypes.node,
    body: PropTypes.node,
    bodyClassName: PropTypes.string,
  };

  static defaultProps = {
    displayTimeout: 100,
  };

  constructor(...args) {
    super(...args);
    this.hoverWait = null;
    this.cardElement = React.createRef();
    this.containerElement = React.createRef();
  }

  state = {
    visible: false,
    rendered: false,
    position: null,
  };

  handleToggleOn = () => this.toggleHovercard(true);
  handleToggleOff = () => this.toggleHovercard(false);

  toggleHovercard = visible => {
    const {header, body} = this.props;

    // Don't toggle hovercard if both of these are null
    if (!header && !body) {
      return;
    }

    if (this.hoverWait !== null) {
      clearTimeout(this.hoverWait);
    }

    const rendered = visible;
    const timeout = this.props.displayTimeout;

    // Immediately render the hovercard, but don't mark it as visible until
    // after the delay period. This allows us to compute the size of the
    // hovercard to position it before it is made visible.
    if (visible) {
      this.setState({rendered}, () => this.positionCard());
    }

    this.hoverWait = setTimeout(
      () => this.setState({visible, rendered, ...(!rendered ? {position: null} : {})}),
      timeout
    );
  };

  positionCard() {
    if (!this.cardElement.current || this.state.visible) {
      return;
    }
    const rect = this.cardElement.current.getBoundingClientRect();

    // Computes the offset that the hovercard should be from the anchor point
    // of the container (top or bottom absolute position).
    const offset = this.containerElement.current.offsetHeight;

    const y = rect.top - offset < 0 ? 'bottom' : 'top';
    const x =
      rect.right > window.innerWidth && !(rect.left < 0)
        ? 'right'
        : rect.left < 0 ? 'left' : 'middle';

    this.setState({position: {x, y, offset}});
  }

  render() {
    const {bodyClassName, containerClassName, className, header, body} = this.props;
    const {rendered, visible, position} = this.state;

    // Maintain the hovercard class name for BC with less styles
    const cx = classNames('hovercard', className);

    return (
      <Container
        className={containerClassName}
        innerRef={this.containerElement}
        onMouseEnter={this.handleToggleOn}
        onMouseLeave={this.handleToggleOff}
      >
        {this.props.children}
        {rendered && (
          <StyledHovercard
            visible={visible}
            withHeader={!!header}
            className={cx}
            position={position || DEFAULT_POSITION}
            innerRef={this.cardElement}
          >
            {header && <Header>{header}</Header>}
            {body && <Body className={bodyClassName}>{body}</Body>}
          </StyledHovercard>
        )}
      </Container>
    );
  }
}

const translateX = x => `translateX(${x === 'middle' ? '-50%' : 0})`;
const slideTranslateY = y => `translateY(${(y === 'top' ? -1 : 1) * 14}px)`;

const slideIn = p => keyframes`
  from {
    transform: ${translateX(p.position.x)} ${slideTranslateY(p.position.y)};
  }
  to {
    transform: ${translateX(p.position.x)} translateY(0);
  }
`;

const positionX = offset => p => css`
  right: ${p.position.x === 'right' ? offset : 'inherit'};
  left: ${p.position.x === 'middle'
    ? '50%'
    : p.position.x === 'left' ? offset : 'inherit'};

  transform: ${translateX(p.position.x)};
`;

const positionY = offset => p => css`
  bottom: ${p.position.y === 'top' ? offset : 'inherit'};
  top: ${p.position.y === 'bottom' ? offset : 'inherit'};
`;

const getTipColor = p =>
  p.position.y === 'bottom' && p.withHeader ? p.theme.offWhite : '#fff';

const StyledHovercard = styled('div')`
  border-radius: 4px;
  text-align: left;
  padding: 0;
  line-height: 1;
  /* Some hovercards overlap the toplevel header, so we need the same zindex to appear on top */
  z-index: ${p => p.theme.zIndex.globalSelectionHeader};
  white-space: initial;
  color: ${p => p.theme.gray5};
  border: 1px solid ${p => p.theme.borderLight};
  background: #fff;
  background-clip: padding-box;
  box-shadow: 0 0 35px 0 rgba(67, 62, 75, 0.2);
  width: 295px;

  /* The hovercard may appear in different contexts, don't inherit fonts */
  font-family: ${p => p.theme.text.family};

  position: absolute;
  ${positionX('-2px')};
  ${p => positionY(`${p.position.offset + 12}px`)};

  animation: ${fadeIn} 100ms, ${slideIn} 100ms ease-in-out;
  animation-play-state: ${p => (p.visible ? 'running' : 'paused')};
  visibility: ${p => (p.visible ? 'visible' : 'hidden')};

  &:before,
  &:after {
    content: '';
    display: block;
    position: absolute;
    z-index: -1;
    border: 10px solid transparent;
    /* stylelint-disable-next-line property-no-unknown */
    border-${p => p.position.y}-color: ${getTipColor};
    ${positionX('20px')};
    ${positionY('-20px')};
  }

  &:before {
    /* stylelint-disable-next-line property-no-unknown */
    border-${p => p.position.y}-color: ${p => p.theme.borderLight};
    ${positionY('-21px')};
  }
`;

const Container = styled('span')`
  position: relative;
`;

const Header = styled('div')`
  font-size: 14px;
  background: ${p => p.theme.offWhite};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  border-radius: 4px 4px 0 0;
  font-weight: 600;
  word-wrap: break-word;

  /* The font needs a little extra padding. It has funny vert alignment. */
  padding: ${space(2 * 0.6)} ${space(2 * 0.75)};
  padding-top: ${space(2 * 0.75)};
`;

const Body = styled('div')`
  padding: ${space(2)};
  min-height: 30px;
`;

export default Hovercard;
