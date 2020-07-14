import React from 'react';

import {t} from 'app/locale';
import {IconInfo} from 'app/icons';
import Alert from 'app/components/alert';

const ComingSoon = () => (
  <Alert type="info" icon={<IconInfo />}>
    {t('This feature is coming soon!')}
  </Alert>
);

export default ComingSoon;
