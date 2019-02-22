import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {isEqual} from 'lodash';
import 'bootstrap/js/tooltip';

// Non-mixin way to get Tooltips
// Right now this just wraps Bootstrap's tooltip
class Tooltip extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    disabled: PropTypes.bool,
    tooltipOptions: PropTypes.object,
    title: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  };

  componentWillReceiveProps(newProps) {
    const {disabled} = this.props;
    if (newProps.disabled && !disabled) {
      this.removeTooltips(this.ref);
    } else if (!newProps.disabled && disabled) {
      this.attachTooltips(this.ref);
    }
  }

  componentDidUpdate = prevProps => {
    // Reattach tooltip if options or tooltip message changes
    if (
      !this.props.disabled &&
      (!isEqual(prevProps.tooltipOptions, this.props.tooltipOptions) ||
        prevProps.title != this.props.title)
    ) {
      this.removeTooltips(this.ref);
      this.attachTooltips(this.ref);
    }
  };

  handleMount = ref => {
    if (ref && !this.ref) {
      this.attachTooltips(ref);
    } else if (!ref && this.ref) {
      this.removeTooltips(ref);
    }

    this.ref = ref;
  };

  attachTooltips = ref => {
    this.$ref = $(ReactDOM.findDOMNode(ref));

    const {title, tooltipOptions} = this.props;
    const options =
      typeof tooltipOptions === 'function'
        ? tooltipOptions.call(this)
        : tooltipOptions || {};

    this.$ref.tooltip({
      title,
      delay: 100,
      container: 'body',
      ...options,
    });
  };

  removeTooltips = ref => {
    this.$ref = $(ReactDOM.findDOMNode(ref));

    const {tooltipOptions} = this.props;

    this.$ref
      .tooltip('destroy') // destroy tooltips on parent ...
      .find(tooltipOptions && tooltipOptions.selector)
      .tooltip('destroy'); // ... and descendents

    this.$ref = null;
  };

  render() {
    const {
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
