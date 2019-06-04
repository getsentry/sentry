import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
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
    const {className, message, onRetry} = this.props;
    return (
      <div className={classNames('alert alert-error alert-block', className)}>
        <p>
          {message}
          {onRetry && (
            <a
              onClick={onRetry}
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
