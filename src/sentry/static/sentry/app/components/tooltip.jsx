import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import 'bootstrap/js/tooltip';

// Non-mixin way to get Tooltips
// Right now this just wraps Bootstrap's tooltip
class Tooltip extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    disabled: PropTypes.bool,
    tooltipOptions: PropTypes.object,
    title: PropTypes.node,
  };

  componentWillReceiveProps(newProps) {
    let {disabled} = this.props;
    if (newProps.disabled && !disabled) {
      this.removeTooltips(this.$ref);
    }
  }

  componentDidUpdate = prevProps => {
    if (prevProps.title != this.props.title) {
      this.removeTooltips(this.$ref);
    }
  };

  handleMount = ref => {
    if (ref && !this.ref) {
      // eslint-disable-next-line react/no-find-dom-node
      this.$ref = $(ReactDOM.findDOMNode(ref));
      this.attachTooltips(this.$ref);
    } else if (!ref && this.ref) {
      this.removeTooltips(this.$ref);
      this.$ref = null;
    }

    this.ref = ref;
  };

  attachTooltips = $el => {
    let {title, tooltipOptions} = this.props;
    let options =
      typeof tooltipOptions === 'function'
        ? tooltipOptions.call(this)
        : tooltipOptions || {};

    $el &&
      $el.tooltip({
        title,
        ...options,
      });
  };

  removeTooltips = $el => {
    let {tooltipOptions} = this.props;
    let tooltipEl = $el;
    if (!tooltipEl) {
      return;
    }
    tooltipEl
      .tooltip('destroy') // destroy tooltips on parent ...
      .find(tooltipOptions && tooltipOptions.selector)
      .tooltip('destroy'); // ... and descendents
  };

  render() {
    let {
      className,
      title,
      children,
      disabled,
      // eslint-disable-next-line no-unused-vars
      tooltipOptions,
      ...props
    } = this.props;

    // Return children as normal if Tooltip is disabled
    // (this lets us do <Tooltip disabled={isDisabled}><Button>Foo</Button></Tooltip>)
    if (disabled) {
      return children;
    }
    return React.cloneElement(children, {
      ...props,
      ref: this.handleMount,
      className: classNames('tip', children.props && children.props.className, className),
      title,
    });
  }
}

export default Tooltip;
