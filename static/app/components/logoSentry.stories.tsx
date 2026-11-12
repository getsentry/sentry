import * as Storybook from 'sentry/stories';

import {LogoSentry} from './logoSentry';

export default Storybook.story('LogoSentry', story => {
  story('Default', () => (
    <Storybook.SizingWindow>
      <LogoSentry />
    </Storybook.SizingWindow>
  ));

  story('Wordmark', () => <LogoSentry />);

  story('No wordmark', () => <LogoSentry showWordmark={false} />);
});
