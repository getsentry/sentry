import PropTypes from 'prop-types';
import React from 'react';

import AlertActions from '../actions/alertActions';
import {t} from '../locale';

export default class AlertMessage extends React.PureComponent {
  static propTypes = {
    alert: PropTypes.shape({
      id: PropTypes.string,
      message: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['success', 'error', 'warning']),
      url: PropTypes.string,
    }),
  };

  closeAlert = () => {
    AlertActions.closeAlert(this.props.alert);
  };

  render = () => {
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
            onClick={this.closeAlert}
          >
            <span aria-hidden="true">×</span>
          </button>
          <span className="icon" />
          {this.props.alert.url ? (
            <a href={this.props.alert.url}>{this.props.alert.message}</a>
          ) : (
            this.props.alert.message
          )}
        </div>
      </div>
    );
  };
}
