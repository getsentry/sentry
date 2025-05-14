import {Fragment} from 'react';

import JSXProperty from 'sentry/components/stories/jsxProperty';
import storyBook from 'sentry/stories/storyBook';

import {NumberInput} from './numberInput';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/input/numberInput';

export default storyBook('NumberInput', (story, APIReference) => {
  APIReference(types.NumberInput);

  story('Default', () => {
    return (
      <Fragment>
        <p>
          The NumberInput component provides a numeric input field with
          increment/decrement buttons. It supports keyboard controls,
          <JSXProperty name="min" value="number" /> and
          <JSXProperty name="max" value="number" /> validation, and comes with full
          accessibility features through React Aria.
        </p>
        <NumberInput />
      </Fragment>
    );
  });
});
