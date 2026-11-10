import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';

import {ReplayUnsupportedAlert} from './replayUnsupportedAlert';

export default Storybook.story('ReplayUnsupportedAlert', story => {
  story('All', () => {
    return (
      <Fragment>
        <p>Requires a project slug to be passed in:</p>
        <ReplayUnsupportedAlert projectSlug="MY-PROJECT" />
      </Fragment>
    );
  });
});
