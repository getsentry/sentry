import React from 'react';
import {withInfo} from '@storybook/addon-info';

import LazyLoad from 'app/components/lazyLoad';

export default {
  title: 'Utilities/LazyLoad',
};

export const _LazyLoad = withInfo('Lazy loads a view/component')(() => {
  const MyComponent = () => (
    <div>View that is loaded after 1000ms to simulate dynamic import</div>
  );

  const getComponent = () =>
    new Promise(resolve => setTimeout(() => resolve(MyComponent), 1000));

  return <LazyLoad component={getComponent} />;
});

_LazyLoad.story = {
  name: 'LazyLoad',
};
