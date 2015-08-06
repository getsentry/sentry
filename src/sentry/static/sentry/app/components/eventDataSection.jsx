import React from "react";
import PropTypes from "../proptypes";

var GroupEventDataSection = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    title: React.PropTypes.any.isRequired,
    type: React.PropTypes.string.isRequired,
    wrapTitle: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      wrapTitle: true
    };
  },

  render: function() {
    return (
      <div className="box">
        <a name={this.props.type} />
        <div className="box-header">
          {this.props.wrapTitle ?
            <h3>{this.props.title}</h3>
          :
            <div>{this.props.title}</div>
          }
        </div>
        <div className="box-content with-padding">
          {this.props.children}
        </div>
      </div>
    );
  }
});

export default GroupEventDataSection;

