import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Slider} from 'sentry/components/core/slider';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/slider';

export default storyBook('Slider', (story, APIReference) => {
  APIReference(types.Slider);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Slider" /> component is a simple slider that can be used to
          select a value from a range.
        </p>
        <Label>
          Basic slider
          <Slider />
        </Label>
      </Fragment>
    );
  });

  story('Disabled', () => {
    return (
      <Fragment>
        <p>
          Use the <JSXProperty name="disabled" value /> prop to disable the slider.
        </p>
        <Label>
          Disabled slider
          <Slider disabled />
        </Label>
      </Fragment>
    );
  });

  story('Label Formatting', () => {
    return (
      <Fragment>
        <p>
          The label display can be controlled using the{' '}
          <JSXProperty name="formatLabel" value={(n: number) => n} /> callback prop.
        </p>
        <Label>
          Disabled slider
          <Slider
            formatLabel={(v: number | '') => `${v}%`}
            min={0}
            max={100}
            step={10}
            defaultValue={10}
          />
        </Label>
      </Fragment>
    );
  });
});

const Label = styled('label')`
  display: flex;
  flex-direction: column;
  align-items: center;
  input {
    margin-top: ${space(2)};
  }
`;
