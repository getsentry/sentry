import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from 'sentry/components/core/checkbox';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/checkbox/index.tsx';

export default storyBook('Checkbox', (story, APIReference) => {
  APIReference(types.Checkbox);

  story('Default', () => {
    return (
      <Fragment>
        <p>Checkboxes currently only support controlled state.</p>
        <SideBySide>
          <Label>
            Default <Checkbox />
          </Label>
          <Label>
            Checked <Checkbox checked />
          </Label>
          <Label>
            Disabled <Checkbox disabled />
          </Label>
          <Label>
            Disabled Checked <Checkbox disabled checked />
          </Label>
          <Label>
            Indeterminate <Checkbox checked="indeterminate" />
          </Label>
          <Label>
            Indeterminate Disabled <Checkbox checked="indeterminate" disabled />
          </Label>
        </SideBySide>
      </Fragment>
    );
  });
});

const Label = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
