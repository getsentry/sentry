import * as React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import Button from 'app/components/button';
import {Panel} from 'app/components/panels';
import {IconInfo} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

type DefaultProps = {
  message: React.ReactNode;
  withIcon: boolean;
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
    withIcon: true,
  };

  shouldComponentUpdate() {
    return false;
  }

  render() {
    const {message, withIcon, onRetry} = this.props;
    return (
      <StyledAlert type="error">
        <Content withIcon={withIcon}>
          {withIcon && <IconInfo size="lg" />}
          <div data-test-id="loading-error-message">{message}</div>
          {onRetry && (
            <Button onClick={onRetry} type="button" priority="default" size="small">
              {t('Retry')}
            </Button>
          )}
        </Content>
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

const Content = styled('div')<{withIcon: boolean}>`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: ${p =>
    p.withIcon ? 'min-content auto max-content' : 'auto max-content'};
  align-items: center;
`;
