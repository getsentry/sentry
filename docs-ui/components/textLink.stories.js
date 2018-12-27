import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import TextLink from 'app/components/textLink';

storiesOf('Links/TextLink', module).add(
  'default',
  withInfo(
    'A react-router <Link> but styled to be more like normal text (i.e. not blue)'
  )(() => <TextLink to="https://www.sentry.io">Sentry</TextLink>)
);
