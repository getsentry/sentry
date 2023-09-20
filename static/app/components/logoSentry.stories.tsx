import LogoSentry from 'sentry/components/logoSentry';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('LogoSentry', story => {
  story('Default', () => (
    <SizingWindow>
      <LogoSentry />
    </SizingWindow>
  ));

  story('Wordmark', () => <LogoSentry showWordmark />);

  story('No wordmark', () => <LogoSentry showWordmark={false} />);
});
