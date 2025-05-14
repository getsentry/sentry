import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Input} from 'sentry/components/core/input';
import JSXNode from 'sentry/components/stories/jsxNode';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/input';

export default storyBook('Input', (story, APIReference) => {
  APIReference(types.Input);

  story('Sizes', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Input" /> component comes in different sizes:
        </p>
        <Grid>
          <label>
            <code>md (default):</code> <Input size="md" />
          </label>
          <label>
            <code>sm:</code> <Input size="sm" value="value" />
          </label>
          <label>
            <code>xs:</code> <Input size="xs" placeholder="placeholder" />
          </label>
        </Grid>
      </Fragment>
    );
  });

  story('Locked', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="Input" /> can either be <code>disabled</code> or{' '}
          <code>readonly</code> to make them non-editable. <code>aria-disabled</code>{' '}
          fields are styled like a <code>disabled</code> field, but they remain
          interactive like a <code>readonly</code> field:
        </p>
        <Grid>
          <label>
            <code>disabled:</code> <Input disabled value="this is disabled" />
          </label>
          <label>
            <code>aria-disabled:</code>{' '}
            <Input aria-disabled value="this is aria-disabled" />
          </label>
          <label>
            <code>readonly:</code> <Input readOnly value="this is readonly" />
          </label>
        </Grid>
      </Fragment>
    );
  });
});

const Grid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
`;
