import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import ProjectLabel from 'sentry-ui/projectLabel';

storiesOf('ProjectLabel', module).add(
  'default',
  withInfo('')(() => <ProjectLabel project={{name: 'Project Name'}} />)
);
