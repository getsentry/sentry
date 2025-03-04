import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Radio} from 'sentry/components/core/radio';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/radio';

export default storyBook('Radio', (story, APIReference) => {
  APIReference(types.Radio);

  story('Default', () => {
    return (
      <SideBySide>
        <Fragment>
          <Label>
            Default
            <Radio />
          </Label>
          <Label>
            Checked
            <Radio checked />
          </Label>
          <Label>
            Disabled
            <Radio disabled />
          </Label>
          <Label>
            Checked & Disabled
            <Radio checked disabled />
          </Label>
        </Fragment>
      </SideBySide>
    );
  });
});

const Label = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
