import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import intersection from 'lodash/intersection';

class Hovercard extends React.Component {
  static propTypes = {
    displayTimeout: PropTypes.number,
    className: PropTypes.string,
    containerClassName: PropTypes.string,
    header: PropTypes.node,
    body: PropTypes.node,
  };

  static defaultProps = {
    displayTimeout: 100,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      visible: false,
      rendered: false,
    };
    this.hoverWait = null;
    this.cardElement = null;
  }

  handleToggleOn = () => this.toggleHovercard(true);
  handleToggleOff = () => this.toggleHovercard(false);

  toggleHovercard = visible => {
    const {header, body} = this.props;

    // Don't toggle hovercard if both of these are null
    if (!header && !body) return;

    if (this.hoverWait !== null) {
      clearTimeout(this.hoverWait);
    }

    const rendered = visible;
    const timeout = this.props.displayTimeout;

    // Immediately render the hovercard, but don't mark it as visible until
    // after the delay period. This allows us to compute the size of the
    // hovercard to position it before it is made visible.
    if (visible) {
      this.setState({rendered});
    }

    this.hoverWait = setTimeout(() => this.setState({visible, rendered}), timeout);
  };

  positionClasses() {
    if (!this.cardElement || !this.state.visible) return {};
    const rect = this.cardElement.getBoundingClientRect();

    const classes = {
      'hovercard-bottom': rect.top < 0,
      'hovercard-left': rect.left < 0,
      'hovercard-right': rect.right > window.innerWidth && !(rect.left < 0),
    };

    // If it's already been given a positon class do not use the recomputed
    // position classes, since they will have been computed from it's new
    // current correct position. Use the previous positions.
    const currentClasses = intersection(this.cardElement.classList, Object.keys(classes));

    return currentClasses.length > 0 ? currentClasses : classes;
  }

  render() {
    const {containerClassName, className, header, body} = this.props;
    const {rendered, visible} = this.state;

    const containerCx = classNames('hovercard-container', containerClassName);
    const cx = classNames('hovercard', this.positionClasses(), className, {
      'with-header': header,
      visible,
    });

    return (
      <span
        className={containerCx}
        onMouseEnter={this.handleToggleOn}
        onMouseLeave={this.handleToggleOff}
      >
        {this.props.children}
        {rendered && (
          <div
            className={cx}
            ref={e => {
              this.cardElement = e;
            }}
          >
            <div className="hovercard-hoverlap" />
            {header && <div className="hovercard-header">{header}</div>}
            {body && <div className="hovercard-body">{body}</div>}
          </div>
        )}
      </span>
    );
  }
}

export default Hovercard;
