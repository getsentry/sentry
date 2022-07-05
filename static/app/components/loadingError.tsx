import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';

type Props = {
  className?: string;
  message?: React.ReactNode;
  onRetry?: () => void;
};

/**
 * Renders an Alert box of type "error". Renders a "Retry" button only if a
 * `onRetry` callback is defined.
 */
function LoadingError({
  className,
  onRetry,
  message = t('There was an error loading data.'),
}: Props) {
  return (
    <StyledAlert
      type="error"
      data-test-id="loading-error"
      showIcon
      className={className}
      trailingItems={
        onRetry && (
          <Button onClick={onRetry} type="button" priority="default" size="sm">
            {t('Retry')}
          </Button>
        )
      }
    >
      {message}
    </StyledAlert>
  );
}

export default LoadingError;

const StyledAlert = styled(Alert)`
  ${/* sc-selector */ Panel} & {
    border-radius: 0;
    border-width: 1px 0;
  }
`;
