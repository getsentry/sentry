import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Tag from 'settings-ui/tag';

storiesOf('Tags', module)
  .add(
    'default',
    withInfo('If you pass no type, it will be gray')(() => <Tag>Development</Tag>)
  )
  .add(
    'warning',
    withInfo('Use this to signal that something is maybe not so great')(() => (
      <Tag type="warning">Development</Tag>
    ))
  )
  .add(
    'success',
    withInfo('Use this to signal something good')(() => (
      <Tag type="success">Development</Tag>
    ))
  );
