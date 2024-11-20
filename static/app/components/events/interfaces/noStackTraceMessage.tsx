import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';

type Props = {
  message?: React.ReactNode;
};

function NoStackTraceMessage({message}: Props) {
  return <Alert type="muted">{message ?? t('No stacktrace found.')}</Alert>;
}

export default NoStackTraceMessage;
