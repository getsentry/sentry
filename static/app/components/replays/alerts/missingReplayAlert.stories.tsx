import * as Storybook from 'sentry/stories';

import {MissingReplayAlert} from './missingReplayAlert';

export default Storybook.story('MissingReplayAlert', story => {
  story('All', () => <MissingReplayAlert orgSlug="MY-ORG" />);
});
