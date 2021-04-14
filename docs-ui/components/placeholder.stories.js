import React from 'react';

import Placeholder from 'app/components/placeholder';

export default {
  title: 'UI/Loaders/Placeholder',
  component: Placeholder,
  args: {
    width: '200px',
    height: '200px',
    bottomGutter: 2,
  },
};

export const Default = ({bottomGutter, height, width}) => (
  <div>
    <h4>Resizable square</h4>
    <Placeholder width={width} height={height} />
    <p>Content below the placeholder</p>

    <h4>Square with bottom gutter</h4>
    <Placeholder height={height} bottomGutter={bottomGutter} />
    <p>Content below the placeholder</p>

    <h4>Round placeholder</h4>
    <Placeholder width="48px" height="48px" shape="circle" />
    <p>Content below the placeholder</p>
  </div>
);

Default.storyName = 'default';
