import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DropdownButton from 'sentry-ui/dropdownButton';

// eslint-disable-next-line
storiesOf('DropdownButton', module).add(
  'dropdown button',
  withInfo('A button that turns into a select')(() => <DropdownButton />)
);
