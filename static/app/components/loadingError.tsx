import {Alert} from 'sentry/components/core/alert';
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
        variant="danger"
        data-test-id="loading-error"
        className={className}
        trailingItems={
          onRetry && (
            <Alert.Button onClick={onRetry} priority="default">
              {t('Retry')}
            </Alert.Button>
          )
        }
      >
        {message}
      </Alert>
    </Alert.Container>
  );
}

export default LoadingError;
