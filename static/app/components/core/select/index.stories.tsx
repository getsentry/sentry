import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import JSXNode from 'sentry/components/stories/jsxNode';
import Matrix from 'sentry/components/stories/matrix';
import {Grid} from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/select';

export default storyBook('Select', (story, APIReference) => {
  APIReference(types.Select);

  story('Sizes', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Select" /> component comes in different sizes:
        </p>
        <Grid columns={3}>
          <Select
            size="md"
            placeholder="medium"
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
            ]}
          />
          <Select
            size="sm"
            placeholder="small"
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
            ]}
          />
          <Select
            size="xs"
            placeholder="x-small"
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
            ]}
          />
        </Grid>
      </Fragment>
    );
  });

  story('Clearable', () => (
    <Fragment>
      <Matrix
        render={props => (
          <Item>
            <Select
              {...props}
              defaultValue={{value: 'item2', label: 'Item 2'}}
              options={[
                {value: 'item1', label: 'Item 1'},
                {value: 'item2', label: 'Item 2'},
              ]}
            />
          </Item>
        )}
        propMatrix={{
          size: ['md', 'sm', 'xs'],
          isClearable: [true, false],
        }}
        selectedProps={['size', 'isClearable']}
      />
    </Fragment>
  ));

  story('Searchable', () => (
    <Fragment>
      <Matrix
        render={props => (
          <Item>
            <Select
              {...props}
              defaultValue={{value: 'item2', label: 'Item 2'}}
              options={[
                {value: 'item1', label: 'Item 1'},
                {value: 'item2', label: 'Item 2'},
              ]}
            />
          </Item>
        )}
        propMatrix={{
          size: ['md', 'sm', 'xs'],
          isSearchable: [true, false],
        }}
        selectedProps={['size', 'isSearchable']}
      />
    </Fragment>
  ));
});

const Item = styled('div')`
  width: 300px;
  height: 100px;
`;
