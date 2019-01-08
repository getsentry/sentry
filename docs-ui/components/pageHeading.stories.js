import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import PageHeading from 'app/components/pageHeading';

storiesOf('UI|PageHeading', module).add(
  'default',
  withInfo(
    'Every page should have a header, and the header should be made with this.'
  )(() => <PageHeading withMargins>Page Header</PageHeading>)
);
