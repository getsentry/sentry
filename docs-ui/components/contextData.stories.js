import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import ContextData from 'app/components/contextData';

storiesOf('UI|ContextData', module).add(
  'strings',
  withInfo('Default')(() => <ContextData data="https://example.org/foo/bar/" />)
);
