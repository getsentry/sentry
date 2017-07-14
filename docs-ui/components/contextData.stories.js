import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import ContextData from 'sentry-ui/contextData';

storiesOf('ContextData').addWithInfo('strings', 'Default', () => (
  <ContextData data="https://example.org/foo/bar/" />
));
