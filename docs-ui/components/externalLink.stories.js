import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import ExternalLink from 'app/components/links/externalLink';

storiesOf('UI|Links/ExternalLink', module).add(
  'default',
  withInfo(
    'A normal anchor that opens URL in a new tab accounting for \'target="_blank"\' vulns'
  )(() => <ExternalLink href="https://www.sentry.io">Sentry</ExternalLink>)
);
