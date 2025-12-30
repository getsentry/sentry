import {Alert, type AlertProps} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';

type Props = {
  variant?: AlertProps['variant'];
};

function PreviewFeature({variant = 'info'}: Props) {
  return (
    <Alert.Container>
      <Alert variant={variant}>
        {t(
          'This feature is a preview and may change in the future. Thanks for being an early adopter!'
        )}
      </Alert>
    </Alert.Container>
  );
}

export default PreviewFeature;
