import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
// import {action} from '@storybook/addon-actions';

import DropdownMenu from 'sentry-ui/dropdownMenu';

storiesOf('DropdownMenu', module).add('default', withInfo('Description')(() => (
  <DropdownMenu />
)));
