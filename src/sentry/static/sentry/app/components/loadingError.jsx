import React from 'react';
import {t} from '../locale';

const LoadingError = React.createClass({
  propTypes: {
    onRetry: React.PropTypes.func,
    message: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      message: t('There was an error loading data.')
    };
  },

  shouldComponentUpdate() {
    return false;
  },

  render() {
    return (
      <div className="alert alert-error alert-block">
        <p>
          {this.props.message}
          {this.props.onRetry &&
            <a onClick={this.props.onRetry} className="btn btn-default btn-sm"
               style={{marginLeft: 5}}>{t('Retry')}</a>
          }
        </p>
      </div>
    );
  }
});

export default LoadingError;

