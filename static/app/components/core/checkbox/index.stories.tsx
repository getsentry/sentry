import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from 'sentry/components/core/checkbox';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

import types from '!!type-loader!sentry/components/core/checkbox/index.tsx';

export default Storybook.story('Checkbox', (story, APIReference) => {
  APIReference(types.Checkbox);

  story('Default', () => {
    return (
      <Fragment>
        <p>Checkboxes currently only support controlled state.</p>
        <Storybook.SideBySide>
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
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});

const Label = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: 0;
  cursor: pointer;
`;
