import React from 'react';
import {withInfo} from '@storybook/addon-info';

import NarrowLayout from 'app/components/narrowLayout';

export default {
  title: 'UI/NarrowLayout',
};

export const _NarrowLayout = withInfo('A narrow layout')(() => (
  <NarrowLayout>Narrow Layout</NarrowLayout>
));

_NarrowLayout.story = {
  name: 'NarrowLayout',
};
