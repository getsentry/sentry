import LogoSentry from 'sentry/components/logoSentry';
import * as Storybook from 'sentry/stories';

export default Storybook.story('LogoSentry', story => {
  story('Default', () => (
    <Storybook.SizingWindow>
      <LogoSentry />
    </Storybook.SizingWindow>
  ));

  story('Wordmark', () => <LogoSentry showWordmark />);

  story('No wordmark', () => <LogoSentry showWordmark={false} />);
});
