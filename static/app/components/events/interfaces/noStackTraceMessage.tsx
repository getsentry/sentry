import {Alert} from 'sentry/components/core/alert';
import {t} from 'sentry/locale';

type Props = {
  message?: React.ReactNode;
};

function NoStackTraceMessage({message}: Props) {
  return (
    <Alert.Container>
      <Alert type="muted">{message ?? t('No stacktrace found.')}</Alert>
    </Alert.Container>
  );
}

export default NoStackTraceMessage;
