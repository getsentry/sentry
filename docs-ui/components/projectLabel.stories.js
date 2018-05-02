import React from 'react';
import {storiesOf} from '@storybook/react';
// import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';

import ProjectLabel from 'app/components/projectLabel';

storiesOf('ProjectLabel', module).add(
  'default',
  withInfo('')(() => {
    return (
      <ProjectLabel
        project={{name: 'Project Name'}}
        organization={{slug: 'test-org', features: []}}
      />
    );
  })
);
