import * as React from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';

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
  static defaultProps: DefaultProps = {
    message: t('There was an error loading data.'),
  };

  shouldComponentUpdate() {
    return false;
  }

  render() {
    const {message, onRetry} = this.props;
    return (
      <StyledAlert
        type="error"
        showIcon
        trailingItems={
          onRetry && (
            <Button onClick={onRetry} type="button" priority="default" size="small">
              {t('Retry')}
            </Button>
          )
        }
      >
        <div data-test-id="loading-error-message">{message}</div>
      </StyledAlert>
    );
  }
}

export default LoadingError;

const StyledAlert = styled(Alert)`
  ${/* sc-selector */ Panel} & {
    border-radius: 0;
    border-width: 1px 0;
  }
`;
