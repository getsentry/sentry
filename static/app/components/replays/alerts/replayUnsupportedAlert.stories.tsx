import {Fragment} from 'react';

import ReplayUnsupportedAlert from 'sentry/components/replays/alerts/replayUnsupportedAlert';
import * as Storybook from 'sentry/stories';

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
