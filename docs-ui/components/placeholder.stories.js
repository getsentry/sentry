import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {text, number} from '@storybook/addon-knobs';

import Placeholder from 'app/components/placeholder';

export default {
  title: 'UI/Loaders/Placeholder',
};

export const Default = withInfo(
  'When you want a rough sized placeholder for content that is loading asynchronously'
)(() => (
  <div>
    <h4>Resizable square</h4>
    <Placeholder width={text('width', '200px')} height={text('height', '200px')} />
    <p>Content below the placeholder</p>

    <h4>Square with bottom gutter</h4>
    <Placeholder
      height={text('height', '200px')}
      bottomGutter={number('bottomGutter', 2)}
    />
    <p>Content below the placeholder</p>

    <h4>Round placeholder</h4>
    <Placeholder width="48px" height="48px" shape="circle" />
    <p>Content below the placeholder</p>
  </div>
));

Default.story = {
  name: 'default',
};
