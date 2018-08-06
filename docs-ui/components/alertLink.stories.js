import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import AlertLink from 'app/components/alertLink';

storiesOf('Links/AlertLink', module)
  .add(
    'default',
    withInfo('A way to loudly link between different parts of the application')(() => (
      <AlertLink to="/settings/account/notifications">
        Check out the notifications settings panel
      </AlertLink>
    ))
  )
  .add(
    'with an icon',
    withInfo('You can optionally pass an icon src')(() => (
      <AlertLink to="/settings/account/notifications" icon="icon-mail">
        Check out the notifications settings panel
      </AlertLink>
    ))
  );
