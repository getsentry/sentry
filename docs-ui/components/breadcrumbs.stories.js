import React from 'react';
import {withInfo} from '@storybook/addon-info';

import Breadcrumbs from 'app/components/breadcrumbs';

export default {
  title: 'UI/Breadcrumbs',
};

export const Default = withInfo('Page breadcrumbs used for navigation')(() => {
  return (
    <Breadcrumbs
      crumbs={[
        {label: 'Test 1', to: '#'},
        {label: 'Test 2', to: '#'},
        {label: 'Test 3', to: '#'},
        {label: 'Test 4', to: null},
      ]}
    />
  );
});

Default.story = {
  name: 'default',
};
