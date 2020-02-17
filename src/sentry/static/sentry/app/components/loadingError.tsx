import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';

type DefaultProps = {
  message: React.ReactNode;
};

type Props = DefaultProps & {
  onRetry?: () => void;
};
class LoadingError extends React.Component<Props> {
  static propTypes = {
    onRetry: PropTypes.func,
    message: PropTypes.string,
  };

  static defaultProps: DefaultProps = {
    message: t('There was an error loading data.'),
  };

  shouldComponentUpdate() {
    return false;
  }

  render() {
    const {message, onRetry} = this.props;
    return (
      <div className="alert alert-error alert-block">
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
