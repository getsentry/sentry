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
    tooltipOptions: PropTypes.object,
    title: PropTypes.node,
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
    $el.tooltip({
      title,
      ...options,
    });
  };

  removeTooltips = $el => {
    let {tooltipOptions} = this.props;
    $el
      .tooltip('destroy') // destroy tooltips on parent ...
      .find(tooltipOptions && tooltipOptions.selector)
      .tooltip('destroy'); // ... and descendents
  };

  render() {
    let {
      className,
      title,
      children,
      // eslint-disable-next-line no-unused-vars
      tooltipOptions,
      ...props
    } = this.props;

    return React.cloneElement(children, {
      ...props,
      ref: this.handleMount,
      className: classNames('tip', children.props && children.props.className, className),
      title,
    });
  }
}

export default Tooltip;
