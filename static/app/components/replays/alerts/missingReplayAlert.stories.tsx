import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('MissingReplayAlert', story => {
  story('All', () => <MissingReplayAlert orgSlug="MY-ORG" />);
});
