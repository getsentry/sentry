import {Checkbox} from 'sentry/components/core/checkbox';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/checkbox/index.tsx';

export default storyBook('Checkbox', (story, APIReference) => {
  APIReference(types.Checkbox);

  story('Default', () => {
    return <Checkbox />;
  });
});
