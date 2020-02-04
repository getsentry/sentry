import React from 'react';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import {IconInfo} from 'app/icons';

const ComingSoon = () => (
  <Alert type="info" icon={<IconInfo />}>
    {t('This feature is coming soon!')}
  </Alert>
);

export default ComingSoon;
