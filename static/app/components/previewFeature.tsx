import type {AlertProps} from 'sentry/components/alert';
import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';

type Props = {
  type?: AlertProps['type'];
};

function PreviewFeature({type = 'info'}: Props) {
  return (
    <Alert.Container>
      <Alert type={type} showIcon>
        {t(
          'This feature is a preview and may change in the future. Thanks for being an early adopter!'
        )}
      </Alert>
    </Alert.Container>
  );
}

export default PreviewFeature;
