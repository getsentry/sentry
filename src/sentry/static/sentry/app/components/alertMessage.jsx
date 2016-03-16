import React from 'react';
import AlertActions from '../actions/alertActions';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import {t} from '../locale';

const AlertMessage = React.createClass({
  propTypes: {
    className: React.PropTypes.string,
    id: React.PropTypes.number.isRequired,
    message: React.PropTypes.string.isRequired,
    type: React.PropTypes.string,
    url: React.PropTypes.string
  },

  mixins: [PureRenderMixin],

  closeAlert: function() {
    AlertActions.closeAlert(this.props.id);
  },

  render: function() {
    let className = this.props.className || 'alert';
    if (this.props.type !== '') {
      className += ' alert-' + this.props.type;
    }

    return (
      <div className={className}>
        <div className="container">
          <button type="button" className="close" aria-label={t('Close')}
                  onClick={this.closeAlert}>
            <span aria-hidden="true">&times;</span>
          </button>
          <span className="icon"></span>
          {this.props.url
            ? <a href={this.props.url}>{this.props.message}</a>
            : this.props.message}
        </div>
      </div>
    );
  }
});

export default AlertMessage;
