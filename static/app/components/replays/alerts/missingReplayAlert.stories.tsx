import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import * as Storybook from 'sentry/stories';

export default Storybook.story('MissingReplayAlert', story => {
  story('All', () => <MissingReplayAlert orgSlug="MY-ORG" />);
});
