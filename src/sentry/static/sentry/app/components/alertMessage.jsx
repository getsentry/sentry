import React from "react";
import AlertActions from '../actions/alertActions';
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var AlertMessage = React.createClass({
  mixins: [PureRenderMixin],

  propTypes: {
    type: React.PropTypes.string,
    children: React.PropTypes.any.isRequired
  },

  closeAlert: function() {
    AlertActions.closeAlert(this.props.id);
  },

  render: function() {
    var className = this.props.className || 'alert';
    if (this.props.type !== '') {
      className += ' alert-' + this.props.type;
    }

    return (
      <div className={className}>
        <button type="button" className="close" aria-label="Close"
                onClick={this.closeAlert}>
          <span aria-hidden="true">&times;</span>
        </button>
        {this.props.message}
      </div>
    );
  }
});

export default AlertMessage;

