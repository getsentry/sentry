import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {IconInfo} from 'app/icons';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import space from 'app/styles/space';

type DefaultProps = {
  message: React.ReactNode;
};

type Props = DefaultProps & {
  onRetry?: () => void;
};

/**
 * Renders an Alert box of type "error". Renders a "Retry" button only if a `onRetry` callback is defined.
 */
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
      <Alert type="error">
        <Content>
          <IconInfo size="lg" />
          <div data-test-id="loading-error-message">{message}</div>
          {onRetry && (
            <Button onClick={onRetry} priority="default" size="small">
              {t('Retry')}
            </Button>
          )}
        </Content>
      </Alert>
    );
  }
}

export default LoadingError;

const Content = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: min-content auto max-content;
  align-items: center;
`;
