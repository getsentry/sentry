import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';
import isPropValid from '@emotion/is-prop-valid';

import {IconInfo} from 'app/icons';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import space from 'app/styles/space';

type DefaultProps = {
  message: React.ReactNode;
  /**
   * Adjust styles to better fit full-width in a panel
   */
  isPanel: boolean;
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
    isPanel: PropTypes.bool,
  };

  static defaultProps: DefaultProps = {
    message: t('There was an error loading data.'),
    isPanel: false,
  };

  shouldComponentUpdate() {
    return false;
  }

  render() {
    const {message, isPanel, onRetry} = this.props;
    return (
      <StyledAlert isPanel={isPanel} type="error">
        <Content>
          <IconInfo size="lg" />
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

const StyledAlert = styled(Alert, {
  shouldForwardProp: prop => isPropValid(prop) && prop !== 'isPanel',
})<{isPanel: boolean}>`
  ${p =>
    p.isPanel &&
    css`
      border-radius: 0;
      border-width: 1px 0;
    `}
`;

const Content = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: min-content auto max-content;
  align-items: center;
`;
