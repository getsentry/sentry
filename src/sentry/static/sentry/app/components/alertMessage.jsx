import React from "react";
import AlertActions from '../actions/alertActions';
import PureRenderMixin from 'react-addons-pure-render-mixin';

var AlertMessage = React.createClass({
  propTypes: {
    type: React.PropTypes.string,
    message: React.PropTypes.string
  },

  mixins: [PureRenderMixin],

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
        <div className="container">
          <button type="button" className="close" aria-label="Close"
                  onClick={this.closeAlert}>
            <span aria-hidden="true">&times;</span>
          </button>
          <span className="icon"></span>
          {this.props.message}
        </div>
      </div>
    );
  }
});

export default AlertMessage;
