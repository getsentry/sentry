var React = require("react");
var AlertActions = require('../actions/alertActions');
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var AlertMessage = React.createClass({
  mixins: [PureRenderMixin],

  propTypes: {
    type: React.PropTypes.string,
    children: React.PropTypes.any.isRequired
  },

  closeAlert: function() {
    AlertActions.closeAlert(this);
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
        {this.props.children}
      </div>
    );
  }
});

module.exports = AlertMessage;
