import React from 'react';
import {withInfo} from '@storybook/addon-info';

import PageHeading from 'app/components/pageHeading';

export default {
  title: 'UI/PageHeading',
};

export const Default = withInfo(
  'Every page should have a header, and the header should be made with this.'
)(() => <PageHeading withMargins>Page Header</PageHeading>);

Default.story = {
  name: 'default',
};
