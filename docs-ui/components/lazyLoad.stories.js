import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import LazyLoad from 'app/components/lazyLoad';

storiesOf('Utility|LazyLoad', module).add(
  'LazyLoad',
  withInfo('Lazy loads a view/component')(() => {
    const MyComponent = () => (
      <div>View that is loaded after 1000ms to simulate dynamic import</div>
    );

    const getComponent = () =>
      new Promise(resolve => setTimeout(() => resolve(MyComponent), 1000));

    return <LazyLoad component={getComponent} />;
  })
);
