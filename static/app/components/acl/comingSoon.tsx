import Alert from 'app/components/alert';
import {IconInfo} from 'app/icons';
import {t} from 'app/locale';

const ComingSoon = () => (
  <Alert type="info" icon={<IconInfo size="md" />}>
    {t('This feature is coming soon!')}
  </Alert>
);

export default ComingSoon;
