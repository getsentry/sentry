import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Slider} from 'sentry/components/core/slider';
import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
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
        <SideBySide>
          <Label>
            Basic slider
            <Slider />
          </Label>
          <Label>
            Disabled slider
            <Slider disabled />
          </Label>
        </SideBySide>
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
