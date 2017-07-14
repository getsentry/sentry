import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';

import ProjectLabel from 'sentry-ui/projectLabel';

storiesOf('ProjectLabel').addWithInfo('', '', () => (
  <ProjectLabel project={{name: 'Project Name'}} />
));
