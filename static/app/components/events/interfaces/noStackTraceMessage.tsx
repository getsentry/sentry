import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';

type Props = {
  message?: React.ReactNode;
};

function NoStackTraceMessage({message}: Props) {
  return (
    <Alert.Container>
      <Alert variant="subtle" showIcon={false}>
        {message ?? t('No stacktrace found.')}
      </Alert>
    </Alert.Container>
  );
}

export default NoStackTraceMessage;
