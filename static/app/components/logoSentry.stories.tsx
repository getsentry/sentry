import LogoSentry from 'sentry/components/logoSentry';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import StoryList from 'sentry/components/stories/storyList';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('LogoSentry', story => {
  story('See Also', () => <StoryList links={['app/icons/icons.stories.tsx']} />);

  story('Default', () => (
    <SizingWindow>
      <LogoSentry />
    </SizingWindow>
  ));

  story('Wordmark', () => <LogoSentry showWordmark />);

  story('No wordmark', () => <LogoSentry showWordmark={false} />);
});
