import {t} from 'app/locale';
import {IconInfo} from 'app/icons';
import Alert from 'app/components/alert';

const ComingSoon = () => (
  <Alert type="info" icon={<IconInfo size="md" />}>
    {t('This feature is coming soon!')}
  </Alert>
);

export default ComingSoon;
