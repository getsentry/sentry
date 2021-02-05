import React from 'react';

import PageHeading from 'app/components/pageHeading';

export default {
  title: 'Layouts/PageHeading',
};

export const Default = () => <PageHeading withMargins>Page Header</PageHeading>;

Default.storyName = 'default';
