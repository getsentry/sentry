import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
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
    <Alert.Container>
      <Alert
        type="error"
        data-test-id="loading-error"
        showIcon
        className={className}
        trailingItems={
          onRetry && (
            <Button onClick={onRetry} priority="default" size="sm">
              {t('Retry')}
            </Button>
          )
        }
      >
        {message}
      </Alert>
    </Alert.Container>
  );
}

export default LoadingError;
