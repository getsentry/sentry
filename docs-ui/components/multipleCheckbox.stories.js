import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import MultipleCheckbox from 'app/views/settings/components/forms/controls/multipleCheckbox';

storiesOf('Forms|Controls', module).add(
  'MultipleCheckbox',
  withInfo('Multiple Checkbox Control (controlled only atm)')(() => (
    <MultipleCheckbox
      choices={[['foo', 'Foo'], ['bar', 'Bar'], ['baz', 'Baz']]}
      value={['bar']}
      onChange={(v, e) => {
        action('MultipleCheckbox change')(v, e);
      }}
    />
  ))
);
