import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';

interface Props {
  message?: React.ReactNode;
}

function NoStackTraceMessage({message}: Props) {
  return <Alert type="error">{message ?? t('No or unknown stacktrace')}</Alert>;
}

export default NoStackTraceMessage;
