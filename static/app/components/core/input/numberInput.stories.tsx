import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';

import {NumberInput} from './numberInput';

import types from '!!type-loader!sentry/components/core/input/numberInput';

export default Storybook.story('NumberInput', (story, APIReference) => {
  APIReference(types.NumberInput);

  story('Default', () => {
    return (
      <Fragment>
        <p>
          The NumberInput component provides a numeric input field with
          increment/decrement buttons. It supports keyboard controls,
          <Storybook.JSXProperty name="min" value="number" /> and
          <Storybook.JSXProperty name="max" value="number" /> validation, and comes with
          full accessibility features through React Aria.
        </p>
        <label>Default size</label>
        <NumberInput />
        <br />
        <label>Extra small size</label>
        <br />
        <NumberInput size="xs" />
      </Fragment>
    );
  });
});
