import * as React from 'react';

import Alert from 'sentry/components/alert';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  type?: React.ComponentProps<typeof Alert>['type'];
};

const PreviewFeature = ({type = 'info'}: Props) => (
  <Alert type={type} icon={<IconLab size="sm" />}>
    {t(
      'This feature is a preview and may change in the future. Thanks for being an early adopter!'
    )}
  </Alert>
);

export default PreviewFeature;
