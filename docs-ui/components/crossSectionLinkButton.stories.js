import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import CrossSectionLinkButton from 'settings-ui/crossSectionLinkButton';

storiesOf('Links/CrossSectionLinkButton', module)
  .add(
    'default',
    withInfo('A way to loudly link between different parts of the application')(() => (
      <CrossSectionLinkButton to="/settings/account/notifications">
        Check out the notifications settings panel
      </CrossSectionLinkButton>
    ))
  )
  .add(
    'with an icon',
    withInfo('You can optionally pass an icon src')(() => (
      <CrossSectionLinkButton to="/settings/account/notifications" icon="icon-mail">
        Check out the notifications settings panel
      </CrossSectionLinkButton>
    ))
  );
