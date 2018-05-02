import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
// import {action} from '@storybook/addon-actions';

import TeamBadge from 'app/components/teamBadge';

storiesOf('TeamBadge', module).add(
  'default',
  withInfo('Standard way to display a team')(() => (
    <TeamBadge team={{slug: 'team-slug'}} />
  ))
);
