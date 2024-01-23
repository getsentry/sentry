import ReplayUnsupportedAlert from 'sentry/components/replays/alerts/replayUnsupportedAlert';
import Matrix from 'sentry/components/stories/matrix';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(ReplayUnsupportedAlert, story => {
  story('All', () => (
    <Matrix
      propMatrix={{
        primaryAction: ['create', 'setup'],
        projectSlug: ['MY-PROJECT'],
      }}
      render={ReplayUnsupportedAlert}
      selectedProps={['primaryAction', 'projectSlug']}
    />
  ));
});
