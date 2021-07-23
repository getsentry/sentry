import React from 'react';

import PageHeading from 'app/components/pageHeading';

export default {
  title: 'Views/Page Heading',
};

export const Default = () => <PageHeading withMargins>Page Header</PageHeading>;

Default.storyName = 'Page Heading';
