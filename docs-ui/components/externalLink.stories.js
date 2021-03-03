import React from 'react';

import ExternalLink from 'app/components/links/externalLink';

export default {
  title: 'Core/Links/ExternalLink',
  component: ExternalLink,
};

export const Default = () => (
  <ExternalLink href="https://www.sentry.io">Sentry</ExternalLink>
);

Default.storyName = 'ExternalLink';
Default.parameters = {
  docs: {
    description: {
      story:
        'A normal anchor that opens URL in a new tab accounting for \'target="_blank"\' vulns',
    },
  },
};
