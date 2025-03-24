import ReplaySlugChooser from 'sentry/components/replays/player/__stories__/replaySlugChooser';
import ReplayDemoSnippet from 'sentry/components/replays/snippet/replayDemoSnippet';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('ReplayDemoSnippet', story => {
  story('Default', () => {
    return (
      <ReplaySlugChooser
        render={replaySlug => <ReplayDemoSnippet replaySlug={replaySlug} />}
      />
    );
  });
});
