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
    minHeight: PropTypes.number,
    minWidth: PropTypes.number,
    maxWidth: PropTypes.number,
    dynamicWidth: PropTypes.bool,
  };

  static defaultProps = {
    displayTimeout: 100,
    minWidth: 295,
    maxWidth: 295,
    minHeight: 50,
    dynamicWidth: false,
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

  isOneLine() {
    if (!this.cardElement || !this.state.visible) return null;
    // spans will create a new bounding box for each line of text
    // if the text wraps, so this is a way to test for text wrapping
    return this.cardBodySpan.getClientRects().length <= 1;
  }

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

  // figure out if we're dealing with hovercard-left or hovercard-right (in which case we don't
  // want to center the hovercard) or hovercard or hovercard-bottom (in which case we do)
  getMargin(classes) {
    if (!this.cardElement || !this.state.visible) return {};

    const rect = this.cardElement.getBoundingClientRect();

    const rectWidth = this.isMultipleLines() ? rect.width : this.getSingleLineWidth();

    if (classes.indexOf('left') !== -1 || classes.indexOf('right')) {
      return -rectWidth / 2;
    } else {
      return 0;
    }
  }

  isMultipleLines() {
    if (!this.cardElement || !this.state.visible) return {};

    // spans will create a new bounding box for each line of text
    // if the text wraps, so this is a way to test for text wrapping
    return this.cardBodySpan.getClientRects().length > 1;
  }

  //computed styles come back like "10px", so convert to the int 10
  stylePxToNum(px) {
    return parseInt(px.slice(0, -2), 10);
  }

  //this will be the width of the overall hovercard, based on the
  //contents of the span in the body and all padding/borders around it
  getSingleLineWidth() {
    if (!this.cardElement || !this.state.visible) return {};

    const spanStyle = getComputedStyle(this.cardBodySpan);
    const spanPadding = 2 * this.stylePxToNum(spanStyle.padding);
    const spanBorder =
      this.stylePxToNum(spanStyle['border-left-width']) +
      this.stylePxToNum(spanStyle['border-right-width']);

    const bodyStyle = getComputedStyle(this.cardBody);
    const bodyPadding = 2 * this.stylePxToNum(bodyStyle.padding);
    const bodyBorder =
      this.stylePxToNum(bodyStyle['border-left-width']) +
      this.stylePxToNum(bodyStyle['border-right-width']);

    const elementStyle = getComputedStyle(this.cardElement);
    const elementPadding = 2 * this.stylePxToNum(elementStyle.padding);
    const elementBorder =
      this.stylePxToNum(elementStyle['border-left-width']) +
      this.stylePxToNum(elementStyle['border-right-width']);

    const spanWidth = this.cardBodySpan.getBoundingClientRect().width;

    return (
      spanWidth +
      spanPadding +
      spanBorder +
      bodyPadding +
      bodyBorder +
      elementPadding +
      elementBorder
    );
  }

  render() {
    const {containerClassName, className, header, body} = this.props;
    const {rendered, visible} = this.state;

    const containerCx = classNames('hovercard-container', containerClassName);
    const cx = classNames('hovercard', this.positionClasses(), className, {
      'with-header': header,
      'one-line': this.isOneLine(),
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
            style={{
              //if we're not using dynamicWidth or if we are but have multiple lines of text,
              //then just use the given minWidth
              minWidth:
                !this.props.dynamicWidth || this.isMultipleLines()
                  ? this.props.minWidth
                  : this.getSingleLineWidth(),
              maxWidth: this.props.maxWidth,
              marginLeft: this.getMargin(cx),
            }}
          >
            <div className="hovercard-hoverlap" />
            {header && <div className="hovercard-header">{header}</div>}
            {body && (
              <div className="hovercard-body">
                <span ref={e => (this.cardBodySpan = e)}>{body}</span>
              </div>
            )}
          </div>
        )}
      </span>
    );
  }
}

export default Hovercard;
