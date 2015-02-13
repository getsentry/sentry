/*** @jsx React.DOM */
var React = require("react");

var $ = require("jquery");
require("bootstrap/js/tooltip");

var TooltipTrigger = React.createClass({
  propTypes: {
    title: React.PropTypes.node.isRequired,
    placement: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      placement: 'left'
    };
  },

  componentDidMount() {
    // These can be configured via options; this is just a demo
    $(this.getDOMNode()).tooltip({
      placement: this.props.placement,
      title: React.renderToString(this.props.title),
      html: true
    });
  },

  componentWillUnmount() {
    var node = $(this.getDOMNode());
    node.tooltip('destroy');
    node.unbind('show.bs.tooltip', 'shown.bs.tooltip', 'hide.bs.tooltip', 'hidden.bs.tooltip');
  },

  render() {
    return this.props.children;
  }
});
