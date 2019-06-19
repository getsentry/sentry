import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import RepoLabel from 'app/components/repoLabel';

storiesOf('RepoLabel', module).add(
  'default',
  withInfo('A badge to use for repo names')(() => {
    return <RepoLabel>prod</RepoLabel>;
  })
);
