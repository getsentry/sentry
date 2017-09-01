import PropTypes from 'prop-types';
import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import AlertActions from '../actions/alertActions';
import {t} from '../locale';

const AlertMessage = React.createClass({
  propTypes: {
    alert: PropTypes.shape({
      id: PropTypes.string,
      message: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['success', 'error', 'warning']),
      url: PropTypes.string
    })
  },

  mixins: [PureRenderMixin],

  closeAlert: function() {
    AlertActions.closeAlert(this.props.alert);
  },

  render: function() {
    let className = 'alert';
    if (this.props.alert.type !== '') {
      className += ' alert-' + this.props.alert.type;
    }

    return (
      <div className={className}>
        <div className="container">
          <button
            type="button"
            className="close"
            aria-label={t('Close')}
            onClick={this.closeAlert}>
            <span aria-hidden="true">×</span>
          </button>
          <span className="icon" />
          {this.props.alert.url
            ? <a href={this.props.alert.url}>{this.props.alert.message}</a>
            : this.props.alert.message}
        </div>
      </div>
    );
  }
});

export default AlertMessage;
