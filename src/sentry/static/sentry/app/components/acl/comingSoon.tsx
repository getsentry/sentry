import React from 'react';

import {t} from 'app/locale';
import Alert from 'app/components/alert';

const ComingSoon = () => (
  <Alert type="info" icon="icon-circle-info">
    {t('This feature is coming soon!')}
  </Alert>
);

export default ComingSoon;
