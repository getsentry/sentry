import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';

class LoadingError extends React.Component {
  static propTypes = {
    onRetry: PropTypes.func,
    message: PropTypes.string,
  };

  static defaultProps = {
    message: t('There was an error loading data.'),
  };

  shouldComponentUpdate() {
    return false;
  }

  render() {
    return (
      <div className="alert alert-error alert-block">
        <p>
          {this.props.message}
          {this.props.onRetry && (
            <a
              onClick={this.props.onRetry}
              className="btn btn-default btn-sm"
              style={{marginLeft: 5}}
            >
              {t('Retry')}
            </a>
          )}
        </p>
      </div>
    );
  }
}

export default LoadingError;
