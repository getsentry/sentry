import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Tag from 'app/views/settings/components/tag';

storiesOf('Tags', module)
  .add(
    'default',
    withInfo('A basic tag-like thing. If you pass no type, it will be gray')(() => (
      <Tag>Development</Tag>
    ))
  )
  .add(
    'warning',
    withInfo(
      'A warning tag-like thing. Use this to signal that something is maybe not so great'
    )(() => <Tag priority="warning">Development</Tag>)
  )
  .add(
    'success',
    withInfo('A happy tag-like thing. Use this to signal something good')(() => (
      <Tag priority="success">Development</Tag>
    ))
  );
