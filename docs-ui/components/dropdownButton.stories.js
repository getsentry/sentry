import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DropdownButton from 'sentry-ui/dropdownButton';

storiesOf('DropdownButton', module)
  .add(
    'closed',
    withInfo('A button meant to be used with some sort of dropdown')(() => (
      <DropdownButton isOpen={false}>Add Something</DropdownButton>
    ))
  )
  .add(
    'open',
    withInfo('A button meant to be used with some sort of dropdown')(() => (
      <DropdownButton isOpen={true}>Add Something</DropdownButton>
    ))
  );
