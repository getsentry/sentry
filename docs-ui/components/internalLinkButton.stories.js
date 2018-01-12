import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import InternalLinkButton from 'settings-ui/internalLinkButton';

storiesOf('Links/InternalLinkButton', module)
  .add(
    'default',
    withInfo('A way to loudly link between different parts of the application')(() => (
      <InternalLinkButton to="/settings/account/notifications">
        Check out the notifications settings panel
      </InternalLinkButton>
    ))
  )
  .add(
    'with an icon',
    withInfo('You can optionally pass an icon src')(() => (
      <InternalLinkButton to="/settings/account/notifications" icon="icon-mail">
        Check out the notifications settings panel
      </InternalLinkButton>
    ))
  );
