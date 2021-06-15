import Alert from 'app/components/alert';
import {t} from 'app/locale';

type Props = {
  message?: React.ReactNode;
};

function NoStackTraceMessage({message}: Props) {
  return <Alert type="error">{message ?? t('No or unknown stacktrace')}</Alert>;
}

export default NoStackTraceMessage;
