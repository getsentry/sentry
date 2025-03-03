import {Checkbox} from 'sentry/components/core/checkbox';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/checkbox/index.tsx';

export default storyBook('Checkbox', (story, APIReference) => {
  APIReference(types.Checkbox);

  story('Default', () => {
    return (
      <SideBySide>
        <label>
          Default <Checkbox />
        </label>
        <label>
          Checked <Checkbox checked />
        </label>
        <label>
          Disabled <Checkbox disabled />
        </label>
        <label>
          Disabled Checked <Checkbox disabled checked />
        </label>
      </SideBySide>
    );
  });
});
