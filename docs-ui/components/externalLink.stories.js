import React from 'react';
import {withInfo} from '@storybook/addon-info';

import ExternalLink from 'app/components/links/externalLink';

export default {
  title: 'Core/Links/ExternalLink',
};

export const Default = withInfo(
  'A normal anchor that opens URL in a new tab accounting for \'target="_blank"\' vulns'
)(() => <ExternalLink href="https://www.sentry.io">Sentry</ExternalLink>);

Default.story = {
  name: 'default',
};
