import React from 'react';

import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';

export const comingSoonText = t(
  'This feature has not been enabled for the current user, project, organization, or Sentry instance.'
);

const ComingSoon = () => (
  <Alert type="warning" icon={<IconWarning size="md" />}>
    {comingSoonText}
  </Alert>
);

export default ComingSoon;
