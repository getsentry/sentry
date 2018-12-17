import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import PageHeader from 'app/components/pageHeader';

storiesOf('UI|PageHeader', module).add(
  'default',
  withInfo(
    'Every page should have a header, and the header should be made with this.'
  )(() => <PageHeader>Page Header</PageHeader>)
);
