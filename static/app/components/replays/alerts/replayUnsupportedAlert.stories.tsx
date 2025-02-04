import {Fragment} from 'react';

import ReplayUnsupportedAlert from 'sentry/components/replays/alerts/replayUnsupportedAlert';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('ReplayUnsupportedAlert', story => {
  story('All', () => {
    return (
      <Fragment>
        <p>Requires a project slug to be passed in:</p>
        <ReplayUnsupportedAlert projectSlug="MY-PROJECT" />
      </Fragment>
    );
  });
});
