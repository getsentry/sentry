var React = require('react');
var joinClasses = require('react-bootstrap/utils/joinClasses');
var classSet = require('react-bootstrap/utils/classSet');
var BootstrapMixin = require('react-bootstrap/BootstrapMixin');


var Tooltip = React.createClass({
  mixins: [BootstrapMixin],

  propTypes: {
    placement: React.PropTypes.oneOf(['top','right', 'bottom', 'left']),
    positionLeft: React.PropTypes.number,
    positionTop: React.PropTypes.number,
    modifiedLeft: React.PropTypes.number,
    arrowOffsetLeft: React.PropTypes.number,
    arrowOffsetTop: React.PropTypes.number
  },

  getDefaultProps: function () {
    return {
      placement: 'right'
    };
  },

  render: function () {
    var classes = {
      tooltip: true,
      in: this.props.positionLeft !== null || this.props.positionTop !== null
    };
    classes[this.props.placement] = true;

    var style = {
      left: this.props.positionLeft,
      top: this.props.positionTop
    };

    var arrowStyle = {
      // TODO(dcramer): figure out where this magical # is from and compute it
      // in a correct way
      marginLeft: this.props.modifiedLeft - 6,
      left: this.props.arrowOffsetLeft,
      top: this.props.arrowOffsetTop
    };

    return (
        <div {...this.props} className={joinClasses(this.props.className, classSet(classes))} style={style}>
          <div className="tooltip-arrow" style={arrowStyle} />
          <div className="tooltip-inner">
            {this.props.children}
          </div>
        </div>
      );
  }
});

module.exports = Tooltip;
